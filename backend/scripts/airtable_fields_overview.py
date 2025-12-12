"""Print field counts and field types for every table in the base."""

from __future__ import annotations

from typing import Dict, List

from .airtable_common import AirtableAuthError, AirtableInspector


def summarize_fields(fields: List[Dict]) -> List[str]:
    summary = []
    for field in fields:
        entry = f"{field['name']} – {field['type']}"
        options = field.get("options")
        if options and isinstance(options, dict):
            # Include compact detail for select/lookups to hint at formatting.
            detail_keys = [k for k in ("choiceOrder", "choices", "linkedTableId", "result") if k in options]
            if detail_keys:
                entry += f" ({', '.join(detail_keys)})"
        summary.append(entry)
    return summary


def main() -> None:
    try:
        inspector = AirtableInspector()
    except AirtableAuthError as exc:
        print(exc)
        return

    tables = inspector.list_tables()
    print(f"Field inventory for base {inspector.base_id}:")
    total_fields = 0
    for table in tables:
        fields = table.get("fields", [])
        total_fields += len(fields)
        print(f"\n{table['name']} ({len(fields)} fields)")
        for field_line in summarize_fields(fields):
            print(f"- {field_line}")
    print(f"\nProcessed {len(tables)} tables • {total_fields} fields total")


if __name__ == "__main__":
    main()
