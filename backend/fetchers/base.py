"""Base fetcher that all entity-specific fetchers can reuse."""

from __future__ import annotations

from typing import Any, Dict, List

from ..clients.airtable import AirtableClient


class BaseFetcher:
    def __init__(self, client: AirtableClient, entity_key: str):
        self._client = client
        self._entity_key = entity_key

    def fetch(self) -> List[Dict[str, Any]]:
        """Fetch all records for the entity.
        
        Returns:
            List of record dictionaries.
        """
        return self._client.fetch_records(self._entity_key)
