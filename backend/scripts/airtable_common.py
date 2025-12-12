"""Shared helpers for Airtable metadata and counting workflows."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv
from pyairtable import Api

# Load .env file from backend directory
backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(backend_dir / ".env")

# Base + PAT env vars used by all scripts.
BASE_ENV = "AIRTABLE_BASE_ID"
PAT_ENV = "AIRTABLE_PAT"

# Default base ID provided for convenience so scripts work out of the box once PAT is set.
DEFAULT_BASE_ID = "appnol2rxwLMp4WfV"

# Default output location for the schema JSON consumed by the backend/frontend.
DEFAULT_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "config" / "airtable_schema.json"


class AirtableAuthError(RuntimeError):
    pass


class AirtableInspector:
    """Lightweight helper to hit Airtable Metadata API + count records."""

    def __init__(self, base_id: Optional[str] = None, pat: Optional[str] = None):
        self.base_id = base_id or os.environ.get(BASE_ENV, DEFAULT_BASE_ID)
        self.pat = pat or os.environ.get(PAT_ENV)
        if not self.pat:
            raise AirtableAuthError(f"Set {PAT_ENV} before running this script.")

        self._api = Api(self.pat)

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.pat}",
            "Content-Type": "application/json",
            "User-Agent": "che-integrity-monitor/metadata-script",
        }

    def list_tables(self) -> List[Dict]:
        """Return metadata for all tables in the base."""
        url = f"https://api.airtable.com/v0/meta/bases/{self.base_id}/tables"
        tables: List[Dict] = []
        offset: Optional[str] = None

        while True:
            params = {"offset": offset} if offset else None
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            response.raise_for_status()
            payload = response.json()
            tables.extend(payload.get("tables", []))
            offset = payload.get("offset")
            if not offset:
                break
        return tables

    def count_records(self, table_name: str) -> int:
        """Count records by paging through the table; avoids pulling all data at once."""
        table = self._api.table(self.base_id, table_name)
        total = 0
        for page in table.iterate(page_size=100):
            total += len(page)
        return total


@dataclass
class SchemaSnapshot:
    """Container for the schema JSON we persist."""

    base_id: str
    fetched_at: str
    tables: List[Dict]

    def to_dict(self) -> Dict:
        return {
            "baseId": self.base_id,
            "fetchedAt": self.fetched_at,
            "tables": self.tables,
        }

    @classmethod
    def build(cls, base_id: str, tables: List[Dict]) -> "SchemaSnapshot":
        return cls(
            base_id=base_id,
            fetched_at=datetime.now(timezone.utc).isoformat(),
            tables=tables,
        )


def ensure_output_path(path: Path) -> Path:
    """Make sure the parent directory exists before writing."""
    path.parent.mkdir(parents=True, exist_ok=True)
    return path
