"""Persist run summaries and metrics to Firestore."""

from __future__ import annotations

from typing import Any, Dict, Iterable, Optional

from ..clients.firestore import FirestoreClient
from ..utils.issues import IssuePayload


class FirestoreWriter:
    def __init__(self, client: FirestoreClient):
        self._client = client

    def write_run(self, run_id: str, payload: Dict[str, Any], metadata: Optional[Dict[str, Any]] = None) -> None:
        """Write run summary to Firestore.

        Args:
            run_id: Unique run identifier
            payload: Issue counts/summary (from scorer.summarize). If empty dict, counts will not be updated.
            metadata: Additional run metadata (status, timestamps, entity_counts, etc.)
        """
        data: Dict[str, Any] = {}
        # Only include counts if payload has content (to avoid overwriting existing counts with empty dict)
        if payload:
            # Transform flat summary into structured counts for frontend compatibility
            counts_structured = self._transform_summary_to_counts(payload)
            data["counts"] = counts_structured
        if metadata:
            data.update(metadata)
        self._client.record_run(run_id, data)

    def _transform_summary_to_counts(self, summary: Dict[str, Any]) -> Dict[str, Any]:
        """Transform flat scorer summary into structured counts.

        Args:
            summary: Flat dictionary from scorer.summarize() with keys like "missing_field:info"

        Returns:
            Structured counts with total, by_type, and by_severity
        """
        by_type: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}
        total = 0

        for key, count in summary.items():
            # Skip special aggregate keys
            if key in ["duplicate_groups_formed"] or key.startswith("attendance:"):
                continue

            # Parse keys like "missing_field:info" or "missing_link"
            if ":" in key:
                issue_type, severity = key.split(":", 1)
                # Aggregate by type
                by_type[issue_type] = by_type.get(issue_type, 0) + count
                # Aggregate by severity
                by_severity[severity] = by_severity.get(severity, 0) + count
                # Add to total
                total += count
            else:
                # Keys without severity (like "missing_field") - this is already aggregated by type
                by_type[key] = count

        return {
            "total": total,
            "by_type": by_type,
            "by_severity": by_severity,
        }

    def write_metrics(self, payload: Dict[str, Any]) -> None:
        """Write daily metrics to Firestore."""
        self._client.record_metrics(payload)

    def write_issues(self, issues: Iterable[IssuePayload], run_id: Optional[str] = None) -> int:
        """Write individual issues to Firestore integrity_issues collection.
        
        Args:
            issues: Iterable of IssuePayload objects to write
            run_id: Optional run ID for progress logging
            
        Returns:
            Number of new issues written (issues that didn't exist before)
        """
        issues_list = list(issues)
        if not issues_list:
            return 0
        
        # Convert IssuePayload objects to dictionaries
        issue_dicts = []
        for issue in issues_list:
            issue_dict = {
                "rule_id": issue.rule_id,
                "issue_type": issue.issue_type,
                "entity": issue.entity,
                "record_id": issue.record_id,
                "severity": issue.severity,
                "description": issue.description,
                "metadata": issue.metadata,
            }
            if issue.related_records:
                issue_dict["related_records"] = issue.related_records
            if run_id:
                issue_dict["run_id"] = run_id
            issue_dicts.append(issue_dict)
        
        # Create progress callback if run_id is provided
        progress_callback = None
        if run_id:
            def log_progress(current: int, total: int, percentage: float) -> None:
                try:
                    if percentage < 10.0:
                        # During existence check phase
                        self.write_log(
                            run_id,
                            "info",
                            f"Checking which issues already exist: {current:,}/{total:,} ({percentage:.1f}%)"
                        )
                    else:
                        # During writing phase
                        self.write_log(
                            run_id,
                            "info",
                            f"Writing issues to Firestore: {current:,}/{total:,} ({percentage:.1f}%)"
                        )
                except Exception:
                    pass  # Don't fail on logging errors
            
            progress_callback = log_progress
        
        new_count, total_count = self._client.record_issues(issue_dicts, progress_callback=progress_callback)
        return new_count

    def write_log(self, run_id: str, level: str, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Write a log entry to Firestore for the run.
        
        Args:
            run_id: Run identifier
            level: Log level (info, warning, error, debug)
            message: Log message
            metadata: Optional additional metadata
        """
        self._client.record_run_log(run_id, level, message, metadata)
