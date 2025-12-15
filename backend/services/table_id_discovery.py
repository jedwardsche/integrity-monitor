"""Service to discover Airtable table IDs from schema JSON."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, Optional

import yaml

logger = logging.getLogger(__name__)

DEFAULT_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "config" / "airtable_schema.json"
DEFAULT_MAPPING_PATH = Path(__file__).resolve().parent.parent / "config" / "table_mapping.yaml"


def load_schema_json(schema_path: Path) -> Dict:
    """Load Airtable schema JSON file.
    
    Args:
        schema_path: Path to schema JSON file
        
    Returns:
        Dictionary containing schema data
        
    Raises:
        FileNotFoundError: If schema file doesn't exist
        json.JSONDecodeError: If schema file is invalid JSON
    """
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found at {schema_path}")
    
    with schema_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_mapping_config(mapping_path: Path) -> Dict[str, str]:
    """Load entity-to-table name mapping from YAML.
    
    Args:
        mapping_path: Path to mapping YAML file
        
    Returns:
        Dictionary mapping entity names to table names
        
    Raises:
        FileNotFoundError: If mapping file doesn't exist
        yaml.YAMLError: If mapping file is invalid YAML
    """
    if not mapping_path.exists():
        raise FileNotFoundError(f"Mapping file not found at {mapping_path}")
    
    with mapping_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
        return data.get("entity_table_mapping", {})


def get_table_id_by_name(schema: Dict, table_name: str) -> Optional[str]:
    """Find table ID by table name in schema.
    
    Args:
        schema: Schema dictionary from load_schema_json
        table_name: Name of the table to find
        
    Returns:
        Table ID if found, None otherwise
    """
    tables = schema.get("tables", [])
    for table in tables:
        if table.get("name") == table_name:
            return table.get("id")
    return None


def discover_table_ids(
    schema_path: Optional[Path] = None,
    mapping_path: Optional[Path] = None,
) -> Dict[str, str]:
    """Discover table IDs from schema JSON using entity-to-table mapping.
    
    Args:
        schema_path: Optional path to schema JSON (defaults to DEFAULT_SCHEMA_PATH)
        mapping_path: Optional path to mapping YAML (defaults to DEFAULT_MAPPING_PATH)
        
    Returns:
        Dictionary mapping entity names to table IDs
        
    Example:
        {
            "students": "tblFBuVmDQ8TRKbLY",
            "parents": "tblXXXXX",
            ...
        }
    """
    schema_file = schema_path or DEFAULT_SCHEMA_PATH
    mapping_file = mapping_path or DEFAULT_MAPPING_PATH
    
    try:
        schema = load_schema_json(schema_file)
        mapping = load_mapping_config(mapping_file)
    except FileNotFoundError as exc:
        logger.error(f"Failed to load schema or mapping: {exc}")
        return {}
    except (json.JSONDecodeError, yaml.YAMLError) as exc:
        logger.error(f"Failed to parse schema or mapping: {exc}")
        return {}
    
    discovered: Dict[str, str] = {}
    
    for entity, table_name in mapping.items():
        table_id = get_table_id_by_name(schema, table_name)
        if table_id:
            discovered[entity] = table_id
            logger.debug(f"Discovered table ID for {entity}: {table_id} ({table_name})")
        else:
            logger.warning(f"Table '{table_name}' not found in schema for entity '{entity}'")
    
    logger.info(f"Discovered {len(discovered)} table IDs from {len(mapping)} entities")
    return discovered


def validate_discovered_ids(
    discovered_ids: Dict[str, str],
    required_entities: Optional[list[str]] = None,
) -> Dict[str, bool]:
    """Validate that all required entities have discovered IDs.
    
    Args:
        discovered_ids: Dictionary of discovered entity -> table_id mappings
        required_entities: Optional list of required entity names
        
    Returns:
        Dictionary mapping entity names to validation status (True if ID found)
    """
    if required_entities is None:
        required_entities = [
            "students",
            "parents",
            "contractors",
            "classes",
            "attendance",
            "truth",
            "payments",
            "data_issues",
        ]
    
    validation = {}
    for entity in required_entities:
        validation[entity] = entity in discovered_ids and bool(discovered_ids[entity])
    
    return validation
