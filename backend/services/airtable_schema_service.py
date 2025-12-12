"""Loader + summarizer for the Airtable schema snapshot JSON."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

DEFAULT_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "config" / "airtable_schema.json"


class AirtableSchemaService:
    """Caches the Airtable schema JSON and provides rollups for the UI."""

    def __init__(self, path: Path = DEFAULT_SCHEMA_PATH):
        self._path = Path(path)
        self._cache: Optional[Dict] = None
        self._mtime: Optional[float] = None

    def load(self) -> Dict:
        if not self._path.exists():
            raise FileNotFoundError(f"Schema file not found at {self._path}")
        mtime = self._path.stat().st_mtime
        if self._cache is None or mtime != self._mtime:
            with self._path.open("r", encoding="utf-8") as handle:
                self._cache = json.load(handle)
            self._mtime = mtime
        return self._cache or {}

    def summary(self) -> Dict:
        data = self.load()
        tables: List[Dict] = data.get("tables", [])
        table_count = len(tables)
        field_count = sum(table.get("fieldCount", len(table.get("fields", []))) for table in tables)
        record_count = sum(table.get("recordCount", 0) for table in tables)

        type_counter: Counter[str] = Counter()
        for table in tables:
            for field in table.get("fields", []):
                type_counter[field.get("type", "unknown")] += 1

        def _top_tables(key: str, limit: int = 5) -> List[Dict]:
            sorted_tables = sorted(
                tables,
                key=lambda table: table.get(key, 0),
                reverse=True,
            )
            return [
                {
                    "id": table.get("id"),
                    "name": table.get("name"),
                    key: table.get(key, 0),
                }
                for table in sorted_tables[:limit]
            ]

        return {
            "baseId": data.get("baseId"),
            "fetchedAt": data.get("fetchedAt"),
            "path": str(self._path),
            "tableCount": table_count,
            "fieldCount": field_count,
            "recordCount": record_count,
            "fieldTypeBreakdown": [{"type": ftype, "count": count} for ftype, count in type_counter.most_common()],
            "topRecordTables": _top_tables("recordCount"),
            "topFieldTables": _top_tables("fieldCount"),
        }


schema_service = AirtableSchemaService()
