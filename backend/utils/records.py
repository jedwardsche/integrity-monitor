"""Helpers for reading Airtable-style record dictionaries."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def build_record_index(records: Dict[str, list]) -> Dict[str, Dict[str, dict]]:
    """Build an index of records by entity and ID for O(1) lookups.
    
    Args:
        records: Dictionary mapping entity names to lists of record dicts
        
    Returns:
        Nested dictionary: {entity_name: {record_id: record_dict}}
    """
    index: Dict[str, Dict[str, dict]] = {}
    for entity_name, entity_records in records.items():
        entity_index: Dict[str, dict] = {}
        for record in entity_records:
            record_id = record.get("id")
            if record_id:
                entity_index[record_id] = record
        index[entity_name] = entity_index
    return index


def is_record_active(record: dict, status_fields: Optional[List[str]] = None) -> bool:
    """Check if a record is considered active based on status fields.
    
    Args:
        record: Record dictionary with 'fields' key
        status_fields: Optional list of field names to check. If None, uses common defaults.
        
    Returns:
        True if record appears active, False otherwise
    """
    if not record:
        return False
    
    fields = record.get("fields", {})
    if not fields:
        return True  # Assume active if no fields (conservative)
    
    # Default status field names to check
    default_status_fields = ["status", "is_active", "active", "enrollment_status", "record_status"]
    check_fields = status_fields or default_status_fields
    
    # Check each status field
    for field_name in check_fields:
        value = get_field(fields, field_name)
        if value is None:
            continue
        
        value_str = str(value).lower().strip()
        
        # Active indicators
        if value_str in ("active", "enrolled", "current", "true", "1", "yes"):
            return True
        
        # Inactive indicators
        if value_str in ("archived", "inactive", "deleted", "withdrawn", "false", "0", "no"):
            return False
    
    # If no status field found or ambiguous, check for common "archived" patterns
    archived_indicators = ["archived", "is_archived", "deleted", "is_deleted"]
    for indicator in archived_indicators:
        if get_field(fields, indicator):
            value = get_field(fields, indicator)
            if isinstance(value, bool) and value:
                return False
            if str(value).lower() in ("true", "1", "yes"):
                return False
    
    # Default to active if no clear inactive signal
    return True


def get_field(fields: Dict[str, Any], key: str) -> Any:
    """Attempt to retrieve a field by key or friendly variants."""
    candidates = {key, key.replace("_", " "), key.title(), key.replace("_", " ").title()}
    for candidate in candidates:
        if candidate in fields:
            return fields[candidate]
    return None


def get_list_field(fields: Dict[str, Any], key: str) -> List[str]:
    value = get_field(fields, key)
    if isinstance(value, list):
        return [str(v) for v in value if v]
    if isinstance(value, str) and value:
        return [value]
    return []


def matches_condition(fields: Dict[str, Any], condition_field: Optional[str], condition_value: Optional[str]) -> bool:
    if not condition_field:
        return True
    current = get_field(fields, condition_field)
    if condition_value is None:
        return bool(current)
    return str(current).lower() == str(condition_value).lower()
