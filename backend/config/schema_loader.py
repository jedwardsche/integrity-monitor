"""Utility helpers for loading the schema configuration."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

from .models import SchemaConfig

logger = logging.getLogger(__name__)

SCHEMA_PATH = Path(__file__).with_name("schema.yaml")


def _deep_merge_schema(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Deep merge override dict into base dict for schema config."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge_schema(result[key], value)
        elif key in result and isinstance(result[key], list) and isinstance(value, list):
            # For lists, merge by appending (or replace if needed)
            result[key] = value  # Replace list entirely
        else:
            result[key] = value
    return result


def _load_firestore_schema_overrides(firestore_client: Optional[Any] = None) -> Dict[str, Any]:
    """Load schema configuration overrides from Firestore.
    
    Args:
        firestore_client: Optional FirestoreClient instance. If None, returns empty dict.
    
    Returns:
        Dict of override values for schema config, or empty dict if Firestore not available.
    """
    if firestore_client is None:
        return {}
    
    try:
        client = firestore_client._get_client()
        config_doc_path = firestore_client._config.config_document
        parts = config_doc_path.split("/")
        if len(parts) != 2:
            return {}
        
        collection_name, doc_id = parts
        doc_ref = client.collection(collection_name).document(doc_id)
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict() or {}
            # Extract schema-related sections (entities, duplicates)
            result = {}
            for key in ["entities", "duplicates"]:
                if key in data:
                    result[key] = data[key]
            return result
    except Exception as exc:
        logger.debug(f"Failed to load Firestore schema overrides: {exc}")
    
    return {}


def load_schema_config(
    path: Optional[Path] = None,
    firestore_client: Optional[Any] = None,
) -> SchemaConfig:
    """Load the schema config YAML into typed objects with optional Firestore overrides.
    
    Args:
        path: Optional path to schema.yaml file. Defaults to SCHEMA_PATH.
        firestore_client: Optional FirestoreClient for loading overrides.
    
    Returns:
        SchemaConfig instance with merged overrides.
    """
    target = path or SCHEMA_PATH
    with target.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    
    # Load Firestore overrides if available
    if firestore_client:
        overrides = _load_firestore_schema_overrides(firestore_client)
        if overrides:
            data = _deep_merge_schema(data, overrides)
    
    return SchemaConfig.model_validate(data)
