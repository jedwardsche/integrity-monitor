"""Load runtime configuration for the integrity monitor."""

from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

from .settings import RuntimeConfig

CONFIG_PATH = Path(__file__).with_name("rules.yaml")

# Pattern to match env("VAR_NAME") placeholders
ENV_PATTERN = re.compile(r'env\("([^"]+)"\)')


def _resolve_env_placeholders(value: Any) -> Any:
    """Recursively resolve env("VAR") placeholders in YAML values."""
    if isinstance(value, str):
        match = ENV_PATTERN.search(value)
        if match:
            var_name = match.group(1)
            env_value = os.getenv(var_name)
            if env_value is None:
                raise ValueError(f"Environment variable {var_name} not set (required by config)")
            return env_value
        return value
    elif isinstance(value, dict):
        return {k: _resolve_env_placeholders(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [_resolve_env_placeholders(item) for item in value]
    else:
        return value


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Deep merge override dict into base dict."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _load_firestore_overrides(firestore_client: Optional[Any] = None) -> Dict[str, Any]:
    """Load configuration overrides from Firestore.
    
    Args:
        firestore_client: Optional FirestoreClient instance. If None, returns empty dict.
    
    Returns:
        Dict of override values, or empty dict if Firestore not available.
    """
    if firestore_client is None:
        return {}
    
    try:
        client = firestore_client._get_client()
        config_doc_path = firestore_client._config.config_document
        # Parse document path (e.g., "integrity_config/current")
        parts = config_doc_path.split("/")
        if len(parts) != 2:
            return {}
        
        collection_name, doc_id = parts
        doc_ref = client.collection(collection_name).document(doc_id)
        doc = doc_ref.get()
        
        if doc.exists:
            return doc.to_dict() or {}
    except Exception:
        # If Firestore is not available or document doesn't exist, return empty dict
        return {}
    
    return {}


def _compute_config_version(yaml_content: str, override_content: Dict[str, Any]) -> str:
    """Compute SHA256 hash of YAML content + override content for version tracking."""
    import json
    
    combined = {
        "yaml": yaml_content,
        "override": json.dumps(override_content, sort_keys=True),
    }
    combined_str = json.dumps(combined, sort_keys=True)
    return hashlib.sha256(combined_str.encode("utf-8")).hexdigest()[:16]


def load_runtime_config(
    path: Optional[Path] = None,
    firestore_client: Optional[Any] = None,
) -> RuntimeConfig:
    """Load runtime configuration from YAML file with optional Firestore overrides.
    
    Args:
        path: Optional path to rules.yaml file. Defaults to CONFIG_PATH.
        firestore_client: Optional FirestoreClient for loading overrides.
    
    Returns:
        RuntimeConfig instance with resolved env placeholders and merged overrides.
    """
    target = path or CONFIG_PATH
    
    # Read YAML file
    with target.open("r", encoding="utf-8") as handle:
        yaml_content = handle.read()
        data = yaml.safe_load(yaml_content)
    
    # Resolve env() placeholders
    data = _resolve_env_placeholders(data)
    
    # Load Firestore overrides
    overrides = _load_firestore_overrides(firestore_client)
    
    # Deep merge overrides into base config
    if overrides:
        data = _deep_merge(data, overrides)
    
    # Compute config version
    config_version = _compute_config_version(yaml_content, overrides)
    
    # Add config_version to metadata
    if "metadata" not in data:
        data["metadata"] = {}
    data["metadata"]["config_version"] = config_version
    
    return RuntimeConfig.model_validate(data)
