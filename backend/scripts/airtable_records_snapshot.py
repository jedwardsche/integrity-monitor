"""Create a schema JSON with field metadata and record counts per table."""

from __future__ import annotations

import argparse
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from multiprocessing import cpu_count
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .airtable_common import (
    DEFAULT_SCHEMA_PATH,
    AirtableAuthError,
    AirtableInspector,
    SchemaSnapshot,
    ensure_output_path,
)


class ProgressReporter:
    """Lightweight progress printer that plays nicely with threads."""

    def __init__(self) -> None:
        self._lock = threading.Lock()

    def update(self, table_name: str, count: int) -> None:
        with self._lock:
            print(f"Counting {table_name}: {count} records", end="\r", flush=True)

    def done(self, table_name: str, count: int, early: bool) -> None:
        with self._lock:
            suffix = " (early stop)" if early else ""
            print(f"Counted {table_name}: {count} records{suffix}".ljust(80))


def count_records_with_progress(
    inspector: AirtableInspector,
    table_name: str,
    stop_after: Optional[int],
    reporter: Optional[ProgressReporter],
) -> Tuple[int, bool]:
    total = 0
    early = False
    for page in inspector._api.table(inspector.base_id, table_name).iterate(page_size=100):
        total += len(page)
        if reporter:
            reporter.update(table_name, total)
        if stop_after and total >= stop_after:
            early = True
            break
    if reporter:
        reporter.done(table_name, total, early)
    return total, early


def build_table_entries(inspector: AirtableInspector, workers: int, stop_after: Optional[int]) -> List[Dict]:
    tables = inspector.list_tables()
    results: List[Dict] = []
    reporter = ProgressReporter()

    def build_entry(table: Dict) -> Dict:
        record_count, early = count_records_with_progress(
            inspector,
            table["name"],
            stop_after=stop_after,
            reporter=reporter,
        )
        fields = table.get("fields", [])
        return {
            "id": table["id"],
            "name": table["name"],
            "description": table.get("description"),
            "primaryFieldId": table.get("primaryFieldId"),
            "fieldCount": len(fields),
            "recordCount": record_count,
            "earlyStopped": early,
            "fields": [
                {
                    "id": field["id"],
                    "name": field["name"],
                    "type": field["type"],
                    "options": field.get("options"),
                }
                for field in fields
            ],
        }

    worker_count = max(1, min(workers, len(tables))) if tables else 1
    if worker_count > 1:
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            for entry in executor.map(build_entry, tables):
                results.append(entry)
    else:
        for table in tables:
            results.append(build_entry(table))

    return results


def write_json(payload: Dict, path: Path) -> None:
    ensure_output_path(path)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote schema snapshot to {path}")


def print_summary(tables: List[Dict]) -> None:
    total_records = sum(table.get("recordCount", 0) for table in tables)
    total_fields = sum(table.get("fieldCount", 0) for table in tables)

    print("\nPer-table counts:")
    for table in tables:
        early = " (early stop)" if table.get("earlyStopped") else ""
        print(
            f"- {table['name']}: {table.get('recordCount', 0)} records{early}, {table.get('fieldCount', 0)} fields"
        )
    print(f"\nTotals: {len(tables)} tables • {total_fields} fields • {total_records} records")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_SCHEMA_PATH,
        help="Where to write the backend-ready schema JSON (default: backend/config/airtable_schema.json).",
    )
    parser.add_argument(
        "--frontend-output",
        type=Path,
        default=None,
        help="Optional path to also write a copy for the frontend (e.g., frontend/public/airtable-schema.json).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=max(2, (cpu_count() or 2) // 2),
        help="Max worker threads when counting records (default: half of CPU cores, minimum 2).",
    )
    parser.add_argument(
        "--stop-after",
        type=int,
        default=None,
        help="Optional soft stop per table (count up to this many records, then mark early stop). Leave unset for full counts.",
    )
    args = parser.parse_args()

    try:
        inspector = AirtableInspector()
    except AirtableAuthError as exc:
        print(exc)
        return

    tables = build_table_entries(inspector, workers=args.workers, stop_after=args.stop_after)
    snapshot = SchemaSnapshot.build(base_id=inspector.base_id, tables=tables)

    payload = snapshot.to_dict()
    write_json(payload, args.output)

    if args.frontend_output:
        write_json(payload, args.frontend_output)

    print_summary(tables)


if __name__ == "__main__":
    main()
