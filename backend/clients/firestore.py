"""Firestore client wrapper used for run metadata and metrics."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

try:
    from google.cloud import firestore
    from google.api_core import retry
except ImportError:
    firestore = None
    retry = None

from ..config.settings import FirestoreConfig

logger = logging.getLogger(__name__)


class FirestoreClient:
    """Firestore client for writing run metadata and metrics."""

    def __init__(self, config: FirestoreConfig):
        self._config = config
        self._client: firestore.Client | None = None

    def _get_client(self) -> firestore.Client:
        """Lazy initialization of Firestore client."""
        if self._client is None:
            if firestore is None:
                raise ImportError(
                    "google-cloud-firestore not installed. Install with: pip install google-cloud-firestore"
                )
            try:
                import os
                from google.auth.exceptions import DefaultCredentialsError
                from google.oauth2 import service_account
                
                # Try to initialize with explicit credentials path if set
                cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                if cred_path:
                    # Resolve relative paths relative to backend directory
                    if not os.path.isabs(cred_path):
                        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                        resolved_path = os.path.join(backend_dir, cred_path)
                        if os.path.exists(resolved_path):
                            cred_path = resolved_path
                        elif not os.path.exists(cred_path):
                            # Try absolute path
                            cred_path = os.path.abspath(cred_path)
                    
                    if os.path.exists(cred_path):
                        # Load credentials explicitly
                        credentials = service_account.Credentials.from_service_account_file(cred_path)
                        self._client = firestore.Client(credentials=credentials, project=credentials.project_id)
                        logger.info(f"Firestore client initialized with credentials from {cred_path}")
                    else:
                        logger.warning(
                            f"Service account file not found at {cred_path}. "
                            f"Trying default credentials..."
                        )
                        self._client = firestore.Client()
                else:
                    # No explicit path, try default credentials
                    self._client = firestore.Client()
            except DefaultCredentialsError as exc:
                error_msg = str(exc)
                raise RuntimeError(
                    f"Firestore credentials not configured. "
                    f"Set GOOGLE_APPLICATION_CREDENTIALS environment variable to point to your service account JSON file. "
                    f"Error: {error_msg}"
                ) from exc
            except Exception as exc:
                error_msg = str(exc)
                if "credentials" in error_msg.lower() or "authentication" in error_msg.lower():
                    raise RuntimeError(
                        f"Firestore authentication failed. "
                        f"Please check your GOOGLE_APPLICATION_CREDENTIALS setting. "
                        f"Error: {error_msg}"
                    ) from exc
                raise
        return self._client

    def record_run(self, run_id: str, payload: Dict[str, Any]) -> None:
        """Write run summary to Firestore integrity_runs collection."""
        try:
            client = self._get_client()
            doc_ref = client.collection(self._config.runs_collection).document(run_id)
            
            # Ensure timestamps are present
            data = payload.copy()
            if "started_at" not in data:
                data["started_at"] = datetime.now(timezone.utc)
            if "ended_at" not in data and "status" in data and data["status"] != "running":
                data["ended_at"] = datetime.now(timezone.utc)
            
            doc_ref.set(data, merge=True)
            logger.info(
                "Recorded run summary",
                extra={"collection": self._config.runs_collection, "run_id": run_id},
            )
        except RuntimeError as exc:
            # Re-raise credential errors with clear message
            raise
        except Exception as exc:
            logger.error(
                "Failed to record run summary",
                extra={"run_id": run_id, "error": str(exc)},
                exc_info=True,
            )
            raise

    def record_metrics(self, payload: Dict[str, Any]) -> None:
        """Write daily metrics to Firestore integrity_metrics_daily collection."""
        try:
            client = self._get_client()
            # Use YYYYMMDD format for document ID
            date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
            doc_ref = client.collection(self._config.metrics_collection).document(date_str)
            
            data = payload.copy()
            data["date"] = date_str
            data["updated_at"] = datetime.now(timezone.utc)
            
            doc_ref.set(data, merge=True)
            logger.info(
                "Recorded daily metrics",
                extra={"collection": self._config.metrics_collection, "date": date_str},
            )
        except Exception as exc:
            logger.error(
                "Failed to record metrics",
                extra={"error": str(exc)},
                exc_info=True,
            )
            raise

    def get_last_successful_run_timestamp(self) -> Optional[datetime]:
        """Get the timestamp of the most recent successful run.
        
        Returns:
            datetime of the most recent successful run's ended_at, or None if no successful runs exist.
        """
        try:
            if firestore is None:
                return None
            
            client = self._get_client()
            collection_ref = client.collection(self._config.runs_collection)
            
            # Query for most recent successful run
            # Uses composite index: status (ASC) + ended_at (DESC)
            query = (
                collection_ref
                .where("status", "==", "success")
                .order_by("ended_at", direction="DESCENDING")
                .limit(1)
            )
            docs = list(query.stream())

            if docs:
                doc_data = docs[0].to_dict()
                ended_at = doc_data.get("ended_at")
                if ended_at:
                    # Convert Firestore timestamp to datetime if needed
                    if hasattr(ended_at, "timestamp"):
                        return datetime.fromtimestamp(ended_at.timestamp(), tz=timezone.utc)
                    elif isinstance(ended_at, datetime):
                        return ended_at
                    else:
                        return None
            
            return None
        except Exception as exc:
            logger.warning(
                "Failed to get last successful run timestamp",
                extra={"error": str(exc)},
                exc_info=True,
            )
            return None

    def record_issues(self, issues: list[Dict[str, Any]]) -> None:
        """Write individual issues to Firestore integrity_issues collection.
        
        Args:
            issues: List of issue dictionaries with rule_id, record_id, etc.
        """
        if not issues:
            logger.info("No issues to write to Firestore")
            return
        
        try:
            client = self._get_client()
            collection_ref = client.collection(self._config.issues_collection)
            
            batch = client.batch()
            batch_count = 0
            total_written = 0
            
            for issue in issues:
                # Use rule_id + record_id as document ID for deduplication
                # Firestore document IDs have a 1500 byte limit and character restrictions
                import hashlib
                import re

                doc_id_parts = f"{issue.get('rule_id', '')}_{issue.get('record_id', '')}"

                # Check if we need to hash (length exceeds 1500 bytes)
                if len(doc_id_parts.encode('utf-8')) > 1500:
                    doc_id = hashlib.sha256(doc_id_parts.encode('utf-8')).hexdigest()
                else:
                    # Sanitize invalid characters
                    doc_id = doc_id_parts.replace('/', '_').replace('\\', '_')
                    # Remove leading/trailing periods
                    doc_id = doc_id.strip('.')
                    # Replace consecutive periods with single period
                    doc_id = re.sub(r'\.{2,}', '.', doc_id)
                    # Ensure it doesn't match __.*__ pattern by replacing if needed
                    if re.match(r'^__.*__$', doc_id):
                        doc_id = f"id_{doc_id}"
                    # Ensure not solely . or .. or empty
                    if doc_id in ('', '.', '..'):
                        doc_id = hashlib.sha256(doc_id_parts.encode('utf-8')).hexdigest()
                
                doc_ref = collection_ref.document(doc_id)
                
                # Prepare issue data with timestamps
                issue_data = issue.copy()
                if "created_at" not in issue_data:
                    issue_data["created_at"] = datetime.now(timezone.utc)
                issue_data["updated_at"] = datetime.now(timezone.utc)
                if "status" not in issue_data:
                    issue_data["status"] = "open"
                
                batch.set(doc_ref, issue_data, merge=True)
                batch_count += 1
                
                # Firestore batch limit is 500 operations
                if batch_count >= 500:
                    batch.commit()
                    total_written += batch_count
                    logger.info(
                        "Wrote batch of issues to Firestore",
                        extra={"batch_size": batch_count, "total_written": total_written},
                    )
                    batch = client.batch()
                    batch_count = 0
            
            # Commit remaining issues
            if batch_count > 0:
                batch.commit()
                total_written += batch_count
                # Explicitly close batch (though Python GC handles it, this is cleaner)
                batch = None
            
            logger.info(
                "Recorded issues to Firestore",
                extra={"collection": self._config.issues_collection, "total_issues": total_written},
            )
        except Exception as exc:
            logger.error(
                "Failed to record issues",
                extra={"error": str(exc), "issue_count": len(issues)},
                exc_info=True,
            )
            raise

    def record_flagged_rule(self, rule_id: str, data: Dict[str, Any]) -> None:
        """Write a flagged rule to Firestore integrity_flagged_rules collection.
        
        Args:
            rule_id: Rule identifier (used as document ID)
            data: Rule data dictionary
        """
        try:
            client = self._get_client()
            collection_ref = client.collection("integrity_flagged_rules")
            doc_ref = collection_ref.document(rule_id)
            
            rule_data = data.copy()
            if "updated_at" not in rule_data:
                rule_data["updated_at"] = datetime.now(timezone.utc)
            
            doc_ref.set(rule_data, merge=True)
            logger.info(
                "Recorded flagged rule",
                extra={"collection": "integrity_flagged_rules", "rule_id": rule_id},
            )
        except Exception as exc:
            logger.error(
                "Failed to record flagged rule",
                extra={"rule_id": rule_id, "error": str(exc)},
                exc_info=True,
            )
            raise

    def record_kpi_sample(self, week_id: str, data: Dict[str, Any]) -> None:
        """Write KPI sample data to Firestore integrity_kpi_samples collection.
        
        Args:
            week_id: Week identifier (YYYY-WW format, used as document ID)
            data: KPI sample data dictionary
        """
        try:
            client = self._get_client()
            collection_ref = client.collection("integrity_kpi_samples")
            doc_ref = collection_ref.document(week_id)
            
            sample_data = data.copy()
            if "updated_at" not in sample_data:
                sample_data["updated_at"] = datetime.now(timezone.utc)
            
            doc_ref.set(sample_data, merge=True)
            logger.info(
                "Recorded KPI sample",
                extra={"collection": "integrity_kpi_samples", "week_id": week_id},
            )
        except Exception as exc:
            logger.error(
                "Failed to record KPI sample",
                extra={"week_id": week_id, "error": str(exc)},
                exc_info=True,
            )
            raise
