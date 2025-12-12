"""Utility helpers for loading the schema configuration."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import yaml

from .models import SchemaConfig

SCHEMA_PATH = Path(__file__).with_name("schema.yaml")


def load_schema_config(path: Optional[Path] = None) -> SchemaConfig:
    """Load the schema config YAML into typed objects."""
    target = path or SCHEMA_PATH
    with target.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return SchemaConfig.model_validate(data)
