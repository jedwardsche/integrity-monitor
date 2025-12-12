"""Required field validation driven by schema config."""

from __future__ import annotations

from typing import Any, Dict, List

from ..config.models import FieldRequirement, SchemaConfig
from ..utils.issues import IssuePayload
from ..utils.records import get_field, matches_condition


def run(records: Dict[str, list], schema_config: SchemaConfig) -> List[IssuePayload]:
    issues: List[IssuePayload] = []
    for entity_name, entity_schema in schema_config.entities.items():
        requirements = entity_schema.missing_key_data
        if not requirements:
            continue
        entity_records = records.get(entity_name, [])
        for record in entity_records:
            fields = record.get("fields", {})
            record_id = record.get("id")
            for req in requirements:
                if not matches_condition(fields, req.condition_field, req.condition_value):
                    continue
                if _violates(fields, req):
                    issues.append(
                        IssuePayload(
                            rule_id=f"required.{entity_name}.{req.field}",
                            issue_type="missing_field",
                            entity=entity_name,
                            record_id=record_id,
                            severity=req.severity,
                            description=req.message,
                        )
                    )
    return issues


def _violates(fields: Dict[str, Any], req: FieldRequirement) -> bool:
    primary_value = get_field(fields, req.field)
    if primary_value:
        return False
    if req.alternate_fields:
        for alt in req.alternate_fields:
            if get_field(fields, alt):
                return False
    return True
