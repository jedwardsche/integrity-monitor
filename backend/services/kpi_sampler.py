"""KPI sampling and measurement service for 90%+ anomaly detection."""

from __future__ import annotations

import logging
import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from ..clients.firestore import FirestoreClient
from ..config.settings import FirestoreConfig, RuntimeConfig
from ..config.config_loader import load_runtime_config

logger = logging.getLogger(__name__)

SAMPLE_SIZE_PER_ENTITY = 100
KPI_TARGET = 0.90  # 90%


class KPISampler:
    """Generates weekly samples and calculates KPI for anomaly detection."""

    def __init__(self, runtime_config: Optional[RuntimeConfig] = None):
        self._config = runtime_config or load_runtime_config()
        self._firestore_client = FirestoreClient(self._config.firestore)

    def generate_weekly_sample(
        self,
        records: Dict[str, List[Dict]],
        week_id: Optional[str] = None,
    ) -> Dict[str, any]:
        """Generate weekly validation sample.
        
        Args:
            records: Dictionary of entity_name -> list of records
            week_id: Optional week identifier (YYYY-WW format). If None, generates from current date.
        
        Returns:
            Dictionary with sample data including week_id, sample_size, sampled_records
        """
        if week_id is None:
            now = datetime.now(timezone.utc)
            year, week_num, _ = now.isocalendar()
            week_id = f"{year}-W{week_num:02d}"
        
        sampled_records: Dict[str, List[str]] = {}
        total_sampled = 0
        
        # Sample from each entity type
        for entity_name, entity_records in records.items():
            if not entity_records:
                continue
            
            # Sample up to SAMPLE_SIZE_PER_ENTITY records
            sample_size = min(SAMPLE_SIZE_PER_ENTITY, len(entity_records))
            sampled = random.sample(entity_records, sample_size)
            sampled_ids = [r.get("id") for r in sampled if r.get("id")]
            sampled_records[entity_name] = sampled_ids
            total_sampled += len(sampled_ids)
        
        sample_data = {
            "week_id": week_id,
            "sample_size": total_sampled,
            "sampled_records": sampled_records,
            "generated_at": datetime.now(timezone.utc),
            "status": "pending_review",  # Waiting for human review
        }
        
        logger.info(
            "Generated weekly KPI sample",
            extra={"week_id": week_id, "sample_size": total_sampled},
        )
        
        return sample_data

    def calculate_kpi(
        self,
        week_id: str,
        reviewer_labels: Dict[str, Dict[str, str]],
        monitor_detections: Dict[str, List[str]],
    ) -> Dict[str, any]:
        """Calculate KPI from reviewer labels and monitor detections.
        
        Args:
            week_id: Week identifier
            reviewer_labels: Dict mapping record_id -> {"anomaly": "yes"/"no", "notes": "..."}
            monitor_detections: Dict mapping entity_name -> list of record_ids flagged by monitor
        
        Returns:
            Dictionary with KPI metrics: true_positives, false_negatives, false_positives, kpi_percent
        """
        # Flatten monitor detections
        monitor_flagged = set()
        for entity_detections in monitor_detections.values():
            monitor_flagged.update(entity_detections)
        
        # Count metrics
        true_positives = 0
        false_negatives = 0
        false_positives = 0
        true_negatives = 0
        
        for record_id, label_data in reviewer_labels.items():
            is_anomaly = label_data.get("anomaly", "").lower() == "yes"
            is_flagged = record_id in monitor_flagged
            
            if is_anomaly and is_flagged:
                true_positives += 1
            elif is_anomaly and not is_flagged:
                false_negatives += 1
            elif not is_anomaly and is_flagged:
                false_positives += 1
            else:
                true_negatives += 1
        
        # Calculate KPI: true_positives / (true_positives + false_negatives)
        total_anomalies = true_positives + false_negatives
        if total_anomalies > 0:
            kpi_percent = (true_positives / total_anomalies) * 100
        else:
            # No anomalies found - perfect if monitor also found none
            kpi_percent = 100.0 if false_positives == 0 else 0.0
        
        kpi_data = {
            "week_id": week_id,
            "sample_size": len(reviewer_labels),
            "true_positives": true_positives,
            "false_negatives": false_negatives,
            "false_positives": false_positives,
            "true_negatives": true_negatives,
            "kpi_percent": round(kpi_percent, 2),
            "measured_at": datetime.now(timezone.utc),
            "meets_target": kpi_percent >= (KPI_TARGET * 100),
        }
        
        logger.info(
            "Calculated KPI",
            extra={
                "week_id": week_id,
                "kpi_percent": kpi_percent,
                "meets_target": kpi_data["meets_target"],
            },
        )
        
        return kpi_data

    def get_monitor_detections_for_sample(
        self,
        week_id: str,
        sampled_records: Dict[str, List[str]],
    ) -> Dict[str, List[str]]:
        """Get monitor detections for sampled records from Firestore.
        
        Args:
            week_id: Week identifier
            sampled_records: Dict mapping entity_name -> list of record_ids
        
        Returns:
            Dict mapping entity_name -> list of record_ids that were flagged
        """
        try:
            client = self._firestore_client._get_client()
            collection_ref = client.collection(self._config.firestore.issues_collection)
            
            # Query issues for sampled records
            all_flagged: Dict[str, List[str]] = defaultdict(list)
            
            for entity_name, record_ids in sampled_records.items():
                for record_id in record_ids:
                    # Query issues for this record
                    query = collection_ref.where("record_id", "==", record_id)
                    docs = list(query.stream())
                    
                    if docs:
                        all_flagged[entity_name].append(record_id)
            
            return dict(all_flagged)
            
        except Exception as exc:
            logger.error(
                "Failed to get monitor detections",
                extra={"week_id": week_id, "error": str(exc)},
                exc_info=True,
            )
            return {}

    def process_weekly_kpi(
        self,
        records: Dict[str, List[Dict]],
        reviewer_labels: Optional[Dict[str, Dict[str, str]]] = None,
    ) -> Dict[str, any]:
        """Generate sample and calculate KPI in one step.
        
        Args:
            records: Dictionary of entity_name -> list of records
            reviewer_labels: Optional reviewer labels. If None, only generates sample.
        
        Returns:
            Complete KPI data dictionary
        """
        # Generate sample
        sample_data = self.generate_weekly_sample(records)
        week_id = sample_data["week_id"]
        
        # Store sample
        self._firestore_client.record_kpi_sample(week_id, sample_data)
        
        if reviewer_labels:
            # Get monitor detections
            monitor_detections = self.get_monitor_detections_for_sample(
                week_id, sample_data["sampled_records"]
            )
            
            # Calculate KPI
            kpi_data = self.calculate_kpi(week_id, reviewer_labels, monitor_detections)
            
            # Merge with sample data
            sample_data.update(kpi_data)
            sample_data["status"] = "completed"
            
            # Update in Firestore
            self._firestore_client.record_kpi_sample(week_id, sample_data)
            
            # Create review task if KPI < 90%
            if not kpi_data["meets_target"]:
                self._create_review_task(week_id, kpi_data)
            
            return sample_data
        
        return sample_data

    def get_recent_kpi_samples(self, limit: int = 8) -> List[Dict]:
        """Get recent KPI samples from Firestore.

        Args:
            limit: Number of recent samples to retrieve (default 8)

        Returns:
            List of KPI sample dictionaries, ordered by measured_at descending
        """
        try:
            client = self._firestore_client._get_client()
            collection_ref = client.collection("integrity_kpi_samples")

            # Query recent samples
            query = collection_ref.order_by("measured_at", direction="DESCENDING").limit(limit)
            docs = list(query.stream())

            samples = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                samples.append(data)

            logger.debug(f"Retrieved {len(samples)} KPI samples from Firestore")
            return samples

        except Exception as exc:
            logger.error(
                "Failed to get KPI samples from Firestore",
                extra={"error": str(exc), "limit": limit},
                exc_info=True,
            )
            return []

    def _create_review_task(self, week_id: str, kpi_data: Dict[str, any]) -> None:
        """Create review task when KPI < 90%.

        Args:
            week_id: Week identifier
            kpi_data: KPI calculation results
        """
        try:
            client = self._firestore_client._get_client()
            collection_ref = client.collection("integrity_review_tasks")
            
            task_id = f"kpi-review-{week_id}"
            doc_ref = collection_ref.document(task_id)
            
            # Determine which modules missed anomalies
            missed_modules = []
            if kpi_data["false_negatives"] > 0:
                # Would need to analyze which check types had false negatives
                missed_modules = ["unknown"]  # Placeholder
            
            task_data = {
                "task_id": task_id,
                "triggered_by_kpi": True,
                "week_id": week_id,
                "kpi_percent": kpi_data["kpi_percent"],
                "false_negatives": kpi_data["false_negatives"],
                "missed_modules": missed_modules,
                "status": "open",
                "created_at": datetime.now(timezone.utc),
                "priority": "high" if kpi_data["kpi_percent"] < 80 else "medium",
            }
            
            doc_ref.set(task_data, merge=True)
            
            logger.info(
                "Created review task for low KPI",
                extra={"week_id": week_id, "kpi_percent": kpi_data["kpi_percent"]},
            )
            
        except Exception as exc:
            logger.error(
                "Failed to create review task",
                extra={"week_id": week_id, "error": str(exc)},
                exc_info=True,
            )


def get_kpi_sampler(runtime_config: Optional[RuntimeConfig] = None) -> KPISampler:
    """Get or create a KPISampler instance."""
    return KPISampler(runtime_config)
