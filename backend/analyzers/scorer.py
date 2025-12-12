"""Aggregate and score issues prior to writing."""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List

from ..utils.issues import IssuePayload


def merge(issues: Iterable[IssuePayload]) -> List[IssuePayload]:
    grouped: Dict[str, IssuePayload] = {}
    for issue in issues:
        key = f"{issue.rule_id}:{issue.record_id}"
        if key not in grouped:
            grouped[key] = issue
        else:
            # Merge metadata counts if needed later.
            existing = grouped[key]
            existing.metadata.update(issue.metadata)
    return list(grouped.values())


def summarize(issues: Iterable[IssuePayload]) -> Dict[str, int]:
    counts = defaultdict(int)
    duplicate_group_ids: set = set()
    attendance_by_metric: Dict[str, int] = defaultdict(int)
    
    for issue in issues:
        counts[issue.issue_type] += 1
        counts[f"{issue.issue_type}:{issue.severity}"] += 1
        
        # Track duplicate groups
        if issue.issue_type == "duplicate" and "group_id" in issue.metadata:
            duplicate_group_ids.add(issue.metadata["group_id"])
        
        # Track attendance anomalies by metric
        if issue.issue_type == "attendance" and "metric" in issue.metadata:
            metric_name = issue.metadata["metric"]
            attendance_by_metric[f"attendance:{metric_name}"] += 1
            attendance_by_metric[f"attendance:{metric_name}:{issue.severity}"] += 1
    
    # Add duplicate groups count
    if duplicate_group_ids:
        counts["duplicate_groups_formed"] = len(duplicate_group_ids)
    
    # Add attendance breakdown
    counts.update(attendance_by_metric)
    
    return dict(counts)
