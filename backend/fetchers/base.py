"""Base fetcher that all entity-specific fetchers can reuse."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from ..clients.airtable import AirtableClient


class BaseFetcher:
    def __init__(self, client: AirtableClient, entity_key: str):
        self._client = client
        self._entity_key = entity_key

    def fetch(self, incremental_since: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """Fetch records, optionally filtered by lastModifiedTime.
        
        Args:
            incremental_since: Optional datetime to filter records modified after this time.
        
        Returns:
            List of record dictionaries.
        """
        return self._client.fetch_records(self._entity_key, incremental_since=incremental_since)
