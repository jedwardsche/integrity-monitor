"""Dataclasses describing issue payloads emitted by checks."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class IssuePayload:
    rule_id: str
    issue_type: str
    entity: str
    record_id: str
    severity: str
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    related_records: Optional[List[str]] = None
