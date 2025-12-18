"""Service for querying and aggregating integrity metrics from Firestore."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from ..clients.firestore import FirestoreClient
from ..config.settings import FirestoreConfig, RuntimeConfig
from ..config.config_loader import load_runtime_config
from ..services.airtable_schema_service import schema_service
from ..services.feedback_analyzer import get_feedback_analyzer

logger = logging.getLogger(__name__)


class IntegrityMetricsService:
    """Aggregates integrity run data and calculates dashboard metrics."""

    def __init__(self, runtime_config: Optional[RuntimeConfig] = None):
        self._config = runtime_config or load_runtime_config()
        self._firestore_client = FirestoreClient(self._config.firestore)

    def get_latest_run(self) -> Optional[Dict]:
        """Get the most recent integrity run summary."""
        try:
            client = self._firestore_client._get_client()
            collection_ref = client.collection(self._config.firestore.runs_collection)

            # Query most recent run
            query = collection_ref.order_by(
                "ended_at", direction="DESCENDING"
            ).limit(1)

            docs = list(query.stream())

            if not docs:
                logger.debug("No runs found in Firestore")
                return None

            doc = docs[0]
            data = doc.to_dict()
            data["id"] = doc.id

            # Convert Firestore timestamps to ISO strings
            for field in ["started_at", "ended_at"]:
                if field in data and hasattr(data[field], "timestamp"):
                    timestamp = data[field].timestamp()
                    data[field] = datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()

            logger.debug(f"Retrieved latest run: {doc.id}")
            return data

        except Exception as exc:
            logger.error(
                "Failed to get latest run from Firestore",
                extra={"error": str(exc)},
                exc_info=True,
            )
            return None

    def get_run_history(self, limit: int = 10) -> List[Dict]:
        """Get recent integrity runs for history table."""
        try:
            client = self._firestore_client._get_client()
            collection_ref = client.collection(self._config.firestore.runs_collection)

            # Query recent runs
            query = collection_ref.order_by(
                "ended_at", direction="DESCENDING"
            ).limit(limit)

            docs = list(query.stream())

            runs = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id

                # Convert Firestore timestamps to ISO strings
                for field in ["started_at", "ended_at"]:
                    if field in data and hasattr(data[field], "timestamp"):
                        timestamp = data[field].timestamp()
                        data[field] = datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()

                runs.append(data)

            logger.debug(f"Retrieved {len(runs)} runs from Firestore")
            return runs

        except Exception as exc:
            logger.error(
                "Failed to get run history from Firestore",
                extra={"error": str(exc), "limit": limit},
                exc_info=True,
            )
            return []

    def get_issue_summary(self) -> Dict:
        """Aggregate current issue counts by type and severity."""
        latest_run = self.get_latest_run()
        if not latest_run:
            return {
                "total": 0,
                "by_type": {},
                "by_severity": {},
                "by_type_severity": {},
            }

        counts = latest_run.get("counts", {})
        by_type: Dict[str, int] = defaultdict(int)
        by_severity: Dict[str, int] = defaultdict(int)
        by_type_severity: Dict[str, int] = {}
        total = 0

        for key, value in counts.items():
            if isinstance(value, int):
                total += value
                if ":" in key:
                    issue_type, severity = key.split(":", 1)
                    by_type[issue_type] += value
                    by_severity[severity] += value
                    by_type_severity[key] = value
                else:
                    by_type[key] += value

        return {
            "total": total,
            "by_type": dict(by_type),
            "by_severity": dict(by_severity),
            "by_type_severity": dict(by_type_severity),
        }

    def get_trend_data(self, days: int = 7) -> List[Dict]:
        """Get daily metrics for trend charts."""
        try:
            client = self._firestore_client._get_client()
            collection_ref = client.collection(self._config.firestore.metrics_collection)

            # Calculate date range
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)

            # Query metrics within date range
            start_date_str = start_date.strftime("%Y%m%d")
            end_date_str = end_date.strftime("%Y%m%d")

            query = collection_ref.where(
                "date", ">=", start_date_str
            ).where(
                "date", "<=", end_date_str
            ).order_by("date", direction="ASCENDING")

            docs = list(query.stream())

            trends = []
            for doc in docs:
                data = doc.to_dict()

                # Extract issue counts by type
                trend_point = {
                    "date": data.get("date", ""),
                    "duplicates": data.get("duplicate:total", 0),
                    "links": data.get("missing_link:total", 0),
                    "attendance": data.get("attendance:total", 0),
                    "missing_fields": data.get("missing_field:total", 0),
                    "total": data.get("total", 0),
                }

                trends.append(trend_point)

            logger.debug(f"Retrieved {len(trends)} trend data points from Firestore")
            return trends

        except Exception as exc:
            logger.error(
                "Failed to get trend data from Firestore",
                extra={"error": str(exc), "days": days},
                exc_info=True,
            )
            return []

    def get_issue_queues(self) -> List[Dict]:
        """Group issues by category for queue display."""
        summary = self.get_issue_summary()
        by_type_severity = summary.get("by_type_severity", {})

        queues: List[Dict] = []

        # Duplicate Parents
        dup_parents = (
            by_type_severity.get("duplicate:warning", 0)
            + by_type_severity.get("duplicate:critical", 0)
        )
        if dup_parents > 0:
            queues.append({
                "title": "Duplicate Parents",
                "detail": "Email + phone collisions across campuses",
                "count": dup_parents,
                "chip": "Identity",
            })

        # Student ↔ Truth gaps
        truth_gaps = (
            by_type_severity.get("missing_link:warning", 0)
            + by_type_severity.get("missing_link:critical", 0)
        )
        if truth_gaps > 0:
            queues.append({
                "title": "Student ↔ Truth gaps",
                "detail": "Missing Truth IDs or inactive references",
                "count": truth_gaps,
                "chip": "Schema",
            })

        # Attendance anomalies
        attendance_issues = (
            by_type_severity.get("attendance:critical", 0)
            + by_type_severity.get("attendance:warning", 0)
        )
        if attendance_issues > 0:
            queues.append({
                "title": "Attendance anomalies",
                "detail": "Excessive absences outside campus ranges",
                "count": attendance_issues,
                "chip": "Risk",
            })

        # Payment linkage
        payment_issues = by_type_severity.get("missing_link:warning", 0)
        if payment_issues > 0:
            queues.append({
                "title": "Payment linkage",
                "detail": "Enrollments without invoices or payment",
                "count": payment_issues,
                "chip": "Finance",
            })

        # Sort by count descending
        queues.sort(key=lambda x: x["count"], reverse=True)
        return queues[:5]  # Top 5

    def get_derived_metrics(self) -> Dict:
        """Calculate derived metrics from schema and integrity data."""
        summary = self.get_issue_summary()
        schema_summary = schema_service.summary()
        
        total_records = schema_summary.get("recordCount", 0)
        by_type_severity = summary.get("by_type_severity", {})
        
        # Critical records count
        critical_count = (
            by_type_severity.get("duplicate:critical", 0)
            + by_type_severity.get("missing_link:critical", 0)
            + by_type_severity.get("missing_field:critical", 0)
            + by_type_severity.get("attendance:critical", 0)
        )
        
        # Duplicate rate (approximate - would need actual duplicate group count)
        duplicate_issues = (
            by_type_severity.get("duplicate:critical", 0)
            + by_type_severity.get("duplicate:warning", 0)
            + by_type_severity.get("duplicate:info", 0)
        )
        duplicate_rate = (duplicate_issues / total_records * 100) if total_records > 0 else 0
        
        # Link health (records with valid links / records requiring links)
        link_issues = (
            by_type_severity.get("missing_link:critical", 0)
            + by_type_severity.get("missing_link:warning", 0)
            + by_type_severity.get("missing_link:info", 0)
        )
        # Estimate: assume ~30% of records require links (students need parents, classes, etc.)
        records_requiring_links = int(total_records * 0.3)
        valid_links = max(0, records_requiring_links - link_issues)
        link_health = (valid_links / records_requiring_links * 100) if records_requiring_links > 0 else 100
        
        # Data completeness (records with all required fields / total records)
        missing_field_issues = (
            by_type_severity.get("missing_field:critical", 0)
            + by_type_severity.get("missing_field:warning", 0)
            + by_type_severity.get("missing_field:info", 0)
        )
        complete_records = max(0, total_records - missing_field_issues)
        completeness = (complete_records / total_records * 100) if total_records > 0 else 100
        
        # Attendance health (inverse of attendance issues rate)
        attendance_issues = (
            by_type_severity.get("attendance:critical", 0)
            + by_type_severity.get("attendance:warning", 0)
            + by_type_severity.get("attendance:info", 0)
        )
        # Estimate: assume ~10% of records are students with attendance tracking
        students_with_attendance = int(total_records * 0.1)
        attendance_health = (
            (max(0, students_with_attendance - attendance_issues) / students_with_attendance * 100)
            if students_with_attendance > 0 else 100
        )
        
        # Overall base health: weighted combination of all metrics
        # Weights: completeness 30%, link_health 30%, duplicate_health 20%, attendance_health 20%
        duplicate_health = max(0, 100 - duplicate_rate)  # Convert rate to health score
        base_health = (
            completeness * 0.3
            + link_health * 0.3
            + duplicate_health * 0.2
            + attendance_health * 0.2
        )
        
        return {
            "critical_records": critical_count,
            "duplicate_rate": round(duplicate_rate, 2),
            "link_health": round(link_health, 2),
            "data_completeness": round(completeness, 2),
            "attendance_health": round(attendance_health, 2),
            "base_health": round(base_health, 2),
            "total_records": total_records,
        }

    def get_flagged_rules(self) -> List[Dict]:
        """Get rules flagged for review due to high ignored percentage.
        
        Returns:
            List of flagged rule dictionaries
        """
        try:
            feedback_analyzer = get_feedback_analyzer(self._config)
            return feedback_analyzer.get_flagged_rules()
        except Exception as exc:
            logger.error(
                "Failed to get flagged rules",
                extra={"error": str(exc)},
                exc_info=True,
            )
            return []


# Singleton instance
_metrics_service: Optional[IntegrityMetricsService] = None


def get_metrics_service() -> IntegrityMetricsService:
    """Get or create the singleton metrics service instance."""
    global _metrics_service
    if _metrics_service is None:
        _metrics_service = IntegrityMetricsService()
    return _metrics_service

