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
            payload: Issue counts/summary (from scorer.summarize)
            metadata: Additional run metadata (status, timestamps, entity_counts, etc.)
        """
        data: Dict[str, Any] = {"counts": payload}
        if metadata:
            data.update(metadata)
        self._client.record_run(run_id, data)

    def write_metrics(self, payload: Dict[str, Any]) -> None:
        """Write daily metrics to Firestore."""
        self._client.record_metrics(payload)

    def write_issues(self, issues: Iterable[IssuePayload]) -> None:
        """Write individual issues to Firestore integrity_issues collection.
        
        Args:
            issues: Iterable of IssuePayload objects to write
        """
        issues_list = list(issues)
        if not issues_list:
            return
        
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
            issue_dicts.append(issue_dict)
        
        self._client.record_issues(issue_dicts)
