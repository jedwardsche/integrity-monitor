"""Airtable client wrapper used by fetchers."""

from __future__ import annotations

import logging
import os
import time
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    stop_after_delay,
    wait_exponential,
)

# Constants
MIN_REQUEST_INTERVAL = float(os.getenv("AIRTABLE_MIN_REQUEST_INTERVAL", "0.2"))  # Seconds between requests
API_TIMEOUT_SECONDS = int(os.getenv("AIRTABLE_API_TIMEOUT_SECONDS", "30"))  # Timeout for retries

try:
    from pyairtable import Api
    from requests.exceptions import HTTPError, RequestException
except ImportError:
    Api = None
    HTTPError = Exception
    RequestException = Exception

from ..config.settings import AirtableConfig

logger = logging.getLogger(__name__)




class AirtableClient:
    """Thin wrapper around pyairtable with retry/rate limiting support."""

    def __init__(self, config: AirtableConfig):
        self._config = config
        self._last_request_time: Dict[str, float] = defaultdict(float)
        self._api: Optional[Api] = None

    def _get_api(self) -> Api:
        """Lazy initialization of pyairtable API client."""
        if self._api is None:
            if Api is None:
                raise ImportError(
                    "pyairtable not installed. Install with: pip install pyairtable"
                )
            api_key = os.getenv("AIRTABLE_API_KEY")
            if not api_key:
                raise ValueError(
                    "AIRTABLE_API_KEY environment variable not set"
                )
            self._api = Api(api_key)
        return self._api

    def _resolve_table(self, key: str) -> Dict[str, str]:
        """Resolve table configuration with validation."""
        table_cfg = self._config.table(key)
        base_id = os.getenv(table_cfg.base_env)
        table_id = os.getenv(table_cfg.table_env)

        if not base_id:
            raise ValueError(
                f"Environment variable {table_cfg.base_env} not set (required for {key})"
            )
        if not table_id:
            raise ValueError(
                f"Environment variable {table_cfg.table_env} not set (required for {key})"
            )

        return {
            "base_id": base_id,
            "table_id": table_id,
        }

    def _throttle_request(self, base_id: str) -> None:
        """Throttle requests to respect rate limits."""
        now = time.time()
        last_time = self._last_request_time[base_id]
        elapsed = now - last_time
        
        if elapsed < MIN_REQUEST_INTERVAL:
            sleep_time = MIN_REQUEST_INTERVAL - elapsed
            time.sleep(sleep_time)
        
        self._last_request_time[base_id] = time.time()

    @retry(
        retry=retry_if_exception_type((HTTPError, RequestException)),
        stop=(stop_after_attempt(3) | stop_after_delay(API_TIMEOUT_SECONDS)),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    def _fetch_with_retry(
        self,
        key: str,
        base_id: str,
        table_id: str,
        incremental_since: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch records with retry logic and rate limiting."""
        self._throttle_request(base_id)

        api = self._get_api()
        table = api.table(base_id, table_id)

        logger.info(
            "Fetching Airtable records",
            extra={
                "entity": key,
                "base": base_id,
                "table": table_id,
                "since": incremental_since.isoformat() if incremental_since else None,
            },
        )

        # Build formula for incremental fetching
        formula = None
        if incremental_since:
            # Format: LAST_MODIFIED_TIME() > '2025-01-01T00:00:00.000Z'
            timestamp_str = incremental_since.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            formula = f"LAST_MODIFIED_TIME() > '{timestamp_str}'"

        # Fetch all records with pagination
        records = []
        try:
            if formula:
                all_records = table.all(formula=formula)
            else:
                all_records = table.all()

            records = all_records

            logger.info(
                "Fetched Airtable records successfully",
                extra={
                    "entity": key,
                    "record_count": len(records),
                    "incremental": incremental_since is not None,
                },
            )

        except Exception as exc:
            logger.error(
                "Error fetching from Airtable",
                extra={
                    "entity": key,
                    "base": base_id,
                    "table": table_id,
                    "error": str(exc),
                },
                exc_info=True,
            )
            raise

        return records

    def fetch_records(
        self,
        key: str,
        incremental_since: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch records for the given logical entity.

        Args:
            key: Entity key (e.g., "students", "parents")
            incremental_since: Optional datetime to filter by lastModifiedTime

        Returns:
            List of record dictionaries
        """
        table_meta = self._resolve_table(key)
        base_id = table_meta["base_id"]
        table_id = table_meta["table_id"]

        try:
            return self._fetch_with_retry(key, base_id, table_id, incremental_since)
        except Exception as exc:
            logger.error(
                "Failed to fetch Airtable records after retries",
                extra={"entity": key, "base": base_id, "error": str(exc)},
                exc_info=True,
            )
            raise

    def fetch_records_by_id(
        self,
        base_id: str,
        table_id: str,
    ) -> List[Dict[str, Any]]:
        """Fetch records directly by base_id and table_id.

        Args:
            base_id: Airtable base ID
            table_id: Airtable table ID

        Returns:
            List of record dictionaries
        """
        try:
            return self._fetch_with_retry("direct", base_id, table_id, None)
        except Exception as exc:
            logger.error(
                "Failed to fetch Airtable records by ID",
                extra={"base": base_id, "table": table_id, "error": str(exc)},
                exc_info=True,
            )
            raise
