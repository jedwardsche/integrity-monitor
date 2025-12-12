"""List how many tables exist in the Airtable base."""

from __future__ import annotations

from .airtable_common import AirtableInspector, AirtableAuthError


def main() -> None:
    try:
        inspector = AirtableInspector()
    except AirtableAuthError as exc:
        print(exc)
        return

    tables = inspector.list_tables()
    print(f"Tables in base {inspector.base_id}:")
    for table in tables:
        print(f"- {table['name']} ({table['id']})")
    print(f"Total tables: {len(tables)}")


if __name__ == "__main__":
    main()
