"""Write issues back to Airtable Data Issues table."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Iterable, List

from ..utils.issues import IssuePayload

try:
    from pyairtable import Api
except ImportError:
    Api = None

logger = logging.getLogger(__name__)

# Batch size for chunked writes to avoid HTTP 413 errors
BATCH_SIZE = int(os.getenv("AIRTABLE_BATCH_SIZE", "10"))

# Module-level API client (lazy initialized)
_api_client: Api | None = None
_table_cache: Dict[str, Any] | None = None


def _get_api() -> Api:
    """Get or create the Airtable API client."""
    global _api_client
    if _api_client is None:
        if Api is None:
            raise ImportError(
                "pyairtable not installed. Install with: pip install pyairtable"
            )
        api_key = os.getenv("AIRTABLE_API_KEY")
        if not api_key:
            raise ValueError("AIRTABLE_API_KEY environment variable not set")
        _api_client = Api(api_key)
    return _api_client


def _get_data_issues_table():
    """Get the Data Issues table."""
    global _table_cache
    if _table_cache is None:
        base_id = os.getenv("AT_DATA_ISSUES_BASE")
        table_id = os.getenv("AT_DATA_ISSUES_TABLE")

        if not base_id:
            raise ValueError(
                "AT_DATA_ISSUES_BASE environment variable not set"
            )
        if not table_id:
            raise ValueError(
                "AT_DATA_ISSUES_TABLE environment variable not set"
            )

        api = _get_api()
        _table_cache = api.table(base_id, table_id)

    return _table_cache


def _issue_to_fields(issue: IssuePayload) -> Dict[str, Any]:
    """Convert IssuePayload to Airtable fields dictionary."""
    fields = {
        "rule_id": issue.rule_id,
        "issue_type": issue.issue_type,
        "entity": issue.entity,
        "record_id": issue.record_id,
        "severity": issue.severity,
        "description": issue.description,
        "status": "open",
    }

    # Add metadata as JSON string
    if issue.metadata:
        fields["metadata"] = json.dumps(issue.metadata)

    # Add related records as comma-separated list
    if issue.related_records:
        fields["related_records"] = ", ".join(issue.related_records)

    return fields


def _upsert_batch(batch: List[IssuePayload], batch_num: int, total_batches: int) -> None:
    """Upsert a single batch of issues to Airtable."""
    table = _get_data_issues_table()

    # First, search for existing records with matching rule_id + record_id
    # Build formula to find existing issues
    rule_record_pairs = [
        f"AND({{rule_id}}='{issue.rule_id}', {{record_id}}='{issue.record_id}')"
        for issue in batch
    ]
    formula = f"OR({', '.join(rule_record_pairs)})"

    try:
        existing_records = table.all(formula=formula)
        existing_map = {
            (rec["fields"].get("rule_id"), rec["fields"].get("record_id")): rec["id"]
            for rec in existing_records
        }

        logger.info(
            f"Found {len(existing_map)} existing issues in batch {batch_num}/{total_batches}",
            extra={"batch_num": batch_num, "existing_count": len(existing_map)},
        )
    except Exception as exc:
        logger.warning(
            f"Failed to query existing issues, will create new records",
            extra={"error": str(exc)},
        )
        existing_map = {}

    # Prepare records for batch operation
    updates = []
    creates = []

    for issue in batch:
        fields = _issue_to_fields(issue)
        key = (issue.rule_id, issue.record_id)

        if key in existing_map:
            # Update existing record
            record_id = existing_map[key]
            updates.append({"id": record_id, "fields": fields})
        else:
            # Create new record
            creates.append(fields)

    # Perform batch operations
    if updates:
        try:
            table.batch_update(updates)
            logger.info(
                f"Updated {len(updates)} issues in batch {batch_num}/{total_batches}",
                extra={"batch_num": batch_num, "update_count": len(updates)},
            )
        except Exception as exc:
            logger.error(
                f"Failed to update issues in batch {batch_num}/{total_batches}",
                extra={"error": str(exc), "update_count": len(updates)},
                exc_info=True,
            )
            raise

    if creates:
        try:
            table.batch_create(creates)
            logger.info(
                f"Created {len(creates)} issues in batch {batch_num}/{total_batches}",
                extra={"batch_num": batch_num, "create_count": len(creates)},
            )
        except Exception as exc:
            logger.error(
                f"Failed to create issues in batch {batch_num}/{total_batches}",
                extra={"error": str(exc), "create_count": len(creates)},
                exc_info=True,
            )
            raise


def upsert(issues: Iterable[IssuePayload]) -> None:
    """Upsert issues to Airtable in chunks to avoid HTTP 413 errors.
    
    Args:
        issues: Iterable of IssuePayload objects to write
    """
    issues_list = list(issues)
    total_count = len(issues_list)
    
    if total_count == 0:
        logger.info("No issues to write to Airtable")
        return
    
    total_batches = (total_count + BATCH_SIZE - 1) // BATCH_SIZE
    
    logger.info(
        "Starting chunked write to Airtable",
        extra={"total_issues": total_count, "batch_size": BATCH_SIZE, "total_batches": total_batches},
    )
    
    success_count = 0
    error_count = 0
    
    for batch_num in range(total_batches):
        start_idx = batch_num * BATCH_SIZE
        end_idx = min(start_idx + BATCH_SIZE, total_count)
        batch = issues_list[start_idx:end_idx]
        
        try:
            _upsert_batch(batch, batch_num + 1, total_batches)
            success_count += len(batch)
            logger.info(
                f"Writing batch {batch_num + 1}/{total_batches} ({len(batch)} issues)",
                extra={"batch_num": batch_num + 1, "batch_size": len(batch)},
            )
        except Exception as exc:
            error_count += len(batch)
            logger.error(
                f"Failed to write batch {batch_num + 1}/{total_batches}",
                extra={"batch_num": batch_num + 1, "batch_size": len(batch), "error": str(exc)},
                exc_info=True,
            )
            # Continue with next batch even if this one fails
    
    logger.info(
        "Completed chunked write to Airtable",
        extra={"total_issues": total_count, "success_count": success_count, "error_count": error_count},
    )
