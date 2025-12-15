"""Orchestrates a single integrity run end-to-end."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from ..analyzers import scorer
from ..checks import attendance, duplicates, links, required_fields
from ..clients.airtable import AirtableClient
from ..clients.firestore import FirestoreClient
from ..clients.logging import get_logger, log_check, log_config_load, log_fetch, log_write
from ..config.config_loader import load_runtime_config
from ..config.schema_loader import load_schema_config
from ..config.settings import RuntimeConfig
from ..utils.errors import CheckFailureError, FetchError, IntegrityRunError, WriteError
from ..utils.issues import IssuePayload
from ..fetchers.registry import build_fetchers
from ..utils.timing import timed
from ..writers import airtable_writer
from ..writers.firestore_writer import FirestoreWriter
from ..services.feedback_analyzer import get_feedback_analyzer
from ..services.table_id_discovery import discover_table_ids
from ..services.config_updater import update_config

logger = get_logger(__name__)


class IntegrityRunner:
    def __init__(
        self,
        runtime_config: RuntimeConfig | None = None,
    ):
        # Load config without Firestore overrides first to get Firestore config
        temp_config = runtime_config or load_runtime_config()
        self._firestore_client = FirestoreClient(temp_config.firestore)
        
        # Reload config with Firestore client to get overrides
        if runtime_config is None:
            self._runtime_config = load_runtime_config(firestore_client=self._firestore_client)
        else:
            self._runtime_config = runtime_config
        
        self._schema_config = load_schema_config()
        self._airtable_client = AirtableClient(self._runtime_config.airtable)
        self._firestore_writer = FirestoreWriter(self._firestore_client)

    def run(self, mode: str = "incremental", trigger: str = "manual") -> Dict[str, Any]:
        run_id = str(uuid.uuid4())
        start = time.time()
        start_time = datetime.now(timezone.utc)
        metrics: Dict[str, int] = {}
        entity_counts: Dict[str, int] = {}
        failed_checks: List[str] = []
        status = "running"  # Start with "running" status
        error_message: str | None = None

        logger.info("Integrity run started", extra={"run_id": run_id, "mode": mode, "trigger": trigger})

        # Auto-discover table IDs before running scan
        try:
            discovered_ids = discover_table_ids()
            if discovered_ids:
                logger.info(
                    "Discovered table IDs before scan",
                    extra={"run_id": run_id, "discovered_count": len(discovered_ids)},
                )
                # Update config with discovered IDs (non-blocking)
                try:
                    update_results = update_config(
                        discovered_ids,
                        firestore_client=self._firestore_client,
                        use_firestore=True,
                    )
                    env_updated = sum(1 for v in update_results.get("env", {}).values() if v)
                    fs_updated = sum(1 for v in update_results.get("firestore", {}).values() if v)
                    logger.info(
                        "Updated config with discovered table IDs",
                        extra={
                            "run_id": run_id,
                            "env_updates": env_updated,
                            "firestore_updates": fs_updated,
                        },
                    )
                    # Reload runtime config to pick up new table IDs
                    self._runtime_config = load_runtime_config(firestore_client=self._firestore_client)
                    self._airtable_client = AirtableClient(self._runtime_config.airtable)
                except Exception as exc:
                    logger.warning(
                        "Failed to update config with discovered table IDs",
                        extra={"run_id": run_id, "error": str(exc)},
                    )
                    # Continue with scan even if config update fails
            else:
                logger.debug("No table IDs discovered, using existing config", extra={"run_id": run_id})
        except Exception as exc:
            logger.warning(
                "Table ID discovery failed, continuing with existing config",
                extra={"run_id": run_id, "error": str(exc)},
            )
            # Don't fail the run if discovery fails

        # Write initial "running" status to Firestore immediately so frontend can see it
        try:
            initial_metadata = {
                "mode": mode,
                "trigger": trigger,
                "status": "running",
                "started_at": start_time,
            }
            self._firestore_writer.write_run(run_id, {}, initial_metadata)
            logger.info("Initial run status written to Firestore", extra={"run_id": run_id})
        except Exception as exc:
            error_msg = str(exc)
            logger.error(
                "Failed to write initial run status to Firestore",
                extra={
                    "run_id": run_id,
                    "error": error_msg,
                    "hint": "Check GOOGLE_APPLICATION_CREDENTIALS environment variable and ensure Firestore is configured"
                },
                exc_info=True
            )
            # Don't fail the run if initial write fails - continue execution
            # The run will still complete and return results, just won't be tracked in Firestore

        try:
            # Load config (with timing)
            config_start = time.time()
            config_version = self._runtime_config.metadata.get("config_version") if self._runtime_config else None
            config_duration_ms = int((time.time() - config_start) * 1000)
            log_config_load(logger, run_id, config_duration_ms, config_version)

            # Fetch records
            try:
                with timed("fetch", metrics):
                    records, entity_counts = self._fetch_records(mode)
                log_fetch(logger, run_id, entity_counts, metrics.get("duration_fetch", 0))
            except Exception as exc:
                # If it's already a specific CustomError, re-raise it (or wrap it preserving details)
                if isinstance(exc, (FetchError, IntegrityRunError)):
                    raise
                # Otherwise wrap in FetchError
                raise FetchError("all", str(exc), run_id) from exc

            # Execute checks
            issues: List[IssuePayload] = []
            try:
                with timed("checks", metrics):
                    # Run each check individually with logging
                    check_results: List[IssuePayload] = []
                    
                    # Duplicates check
                    check_start = time.time()
                    dup_issues = duplicates.run(records)
                    check_results.extend(dup_issues)
                    dup_summary = scorer.summarize(dup_issues)
                    log_check(
                        logger,
                        run_id,
                        "duplicates",
                        len(dup_issues),
                        int((time.time() - check_start) * 1000),
                        {k: v for k, v in dup_summary.items() if "duplicate" in k},
                    )
                    
                    # Links check
                    check_start = time.time()
                    link_issues = links.run(records, self._schema_config)
                    check_results.extend(link_issues)
                    link_summary = scorer.summarize(link_issues)
                    log_check(
                        logger,
                        run_id,
                        "links",
                        len(link_issues),
                        int((time.time() - check_start) * 1000),
                        {k: v for k, v in link_summary.items() if "link" in k},
                    )
                    
                    # Required fields check
                    check_start = time.time()
                    req_issues = required_fields.run(records, self._schema_config)
                    check_results.extend(req_issues)
                    req_summary = scorer.summarize(req_issues)
                    log_check(
                        logger,
                        run_id,
                        "required_fields",
                        len(req_issues),
                        int((time.time() - check_start) * 1000),
                        {k: v for k, v in req_summary.items() if "required" in k},
                    )
                    
                    # Attendance check
                    check_start = time.time()
                    att_issues = attendance.run(records, self._runtime_config.attendance_rules)
                    check_results.extend(att_issues)
                    att_summary = scorer.summarize(att_issues)
                    log_check(
                        logger,
                        run_id,
                        "attendance",
                        len(att_issues),
                        int((time.time() - check_start) * 1000),
                        {k: v for k, v in att_summary.items() if "attendance" in k},
                    )
                    
                    issues = check_results
                    merged = scorer.merge(issues)
                    summary = scorer.summarize(merged)
            except Exception as exc:
                logger.error("Check execution failed catastrophically", extra={"run_id": run_id}, exc_info=True)
                failed_checks.append("all")
                status = "error"  # Catastrophic failure should be error, not warning
                error_message = f"Check execution failed: {str(exc)}"
                # Fail fast - don't continue with empty results when all checks fail
                raise IntegrityRunError(run_id, error_message, transient=False) from exc

            # Write to Airtable
            try:
                if issues:
                    with timed("write_airtable", metrics):
                        airtable_writer.upsert(merged if issues else [])
                    log_write(logger, run_id, "airtable", len(merged) if issues else 0, metrics.get("duration_write_airtable", 0))
            except Exception as exc:
                logger.error("Airtable write failed", extra={"run_id": run_id}, exc_info=True)
                failed_checks.append("airtable_write")
                if status == "success":
                    status = "warning"
                error_message = (error_message or "") + f" Airtable write failed: {str(exc)}"

            # Always write to Firestore, even on failure
            try:
                with timed("write_firestore", metrics):
                    run_metadata = {
                        "mode": mode,
                        "trigger": trigger,
                        "entity_counts": entity_counts,
                        "status": status,
                        "started_at": start_time,  # Keep original start time
                        "config_version": config_version,
                        **metrics,
                    }
                    if failed_checks:
                        run_metadata["failed_checks"] = failed_checks
                    if error_message:
                        run_metadata["error_message"] = error_message

                    # Update the existing document (merge=True in record_run)
                    try:
                        self._firestore_writer.write_run(run_id, summary, run_metadata)
                    except RuntimeError as exc:
                        # Credential errors - log but don't fail
                        logger.error(
                            "Firestore credentials not configured - run will not be tracked in Firestore",
                            extra={"run_id": run_id, "error": str(exc)},
                        )
                    except Exception as exc:
                        logger.error(
                            "Failed to write run to Firestore",
                            extra={"run_id": run_id, "error": str(exc)},
                            exc_info=True,
                        )
                    
                    if status == "success":
                        try:
                            metrics_payload = {**summary, **entity_counts}
                            self._firestore_writer.write_metrics(metrics_payload)
                        except Exception as exc:
                            logger.warning(
                                "Failed to write metrics to Firestore",
                                extra={"run_id": run_id, "error": str(exc)},
                            )
                    
                    # Write individual issues to Firestore
                    if issues:
                        try:
                            with timed("write_issues_firestore", metrics):
                                self._firestore_writer.write_issues(merged if issues else [])
                            log_write(logger, run_id, "firestore_issues", len(merged) if issues else 0, metrics.get("duration_write_issues_firestore", 0))
                        except Exception as exc:
                            logger.error("Failed to write issues to Firestore", extra={"run_id": run_id}, exc_info=True)
                            # Don't fail the run if issue writing fails
                    
                    # Analyze ignored issues and flag rules (nightly runs only)
                    if trigger == "nightly" and status == "success":
                        try:
                            with timed("feedback_analysis", metrics):
                                feedback_analyzer = get_feedback_analyzer(self._runtime_config)
                                flagged_rules = feedback_analyzer.analyze_ignored_issues()
                                if flagged_rules:
                                    feedback_analyzer.record_flagged_rules(flagged_rules)
                            logger.info(
                                "Feedback analysis completed",
                                extra={"run_id": run_id, "flagged_rules": len(flagged_rules)},
                            )
                        except Exception as exc:
                            logger.warning(
                                "Feedback analysis failed",
                                extra={"run_id": run_id, "error": str(exc)},
                                exc_info=True,
                            )
                            # Don't fail the run if feedback analysis fails
                    
                    log_write(logger, run_id, "firestore", 1, metrics.get("duration_write_firestore", 0))
            except Exception as exc:
                logger.error("Firestore write failed", extra={"run_id": run_id}, exc_info=True)
                # This is critical - log but don't fail the run
                error_message = (error_message or "") + f" Firestore write failed: {str(exc)}"

        except IntegrityRunError as exc:
            status = "error"
            error_message = str(exc)
            logger.error(
                "Integrity run failed",
                extra={"run_id": run_id, "error": error_message},
                exc_info=True,
            )
            # Still try to write status to Firestore
            try:
                run_metadata = {
                    "mode": mode,
                    "status": status,
                    "started_at": start_time,
                    "ended_at": datetime.now(timezone.utc),
                    "error_message": error_message,
                    **metrics,
                }
                self._firestore_writer.write_run(run_id, {}, run_metadata)
            except Exception:
                logger.error("Failed to write error status to Firestore", extra={"run_id": run_id})

        except Exception as exc:
            status = "error"
            error_message = f"Unexpected error: {str(exc)}"
            logger.error(
                "Integrity run failed with unexpected error",
                extra={"run_id": run_id, "error": error_message},
                exc_info=True,
            )
            # Still try to write status to Firestore
            try:
                run_metadata = {
                    "mode": mode,
                    "status": status,
                    "started_at": start_time,
                    "ended_at": datetime.now(timezone.utc),
                    "error_message": error_message,
                    **metrics,
                }
                self._firestore_writer.write_run(run_id, {}, run_metadata)
            except Exception:
                logger.error("Failed to write error status to Firestore", extra={"run_id": run_id})

        finally:
            elapsed_ms = int((time.time() - start) * 1000)
            end_time = datetime.now(timezone.utc)

            # Ensure final status is written
            try:
                final_metadata = {
                    "status": status,
                    "ended_at": end_time,
                    "duration_ms": elapsed_ms,
                }
                if error_message:
                    final_metadata["error_message"] = error_message
                if failed_checks:
                    final_metadata["failed_checks"] = failed_checks
                self._firestore_writer.write_run(run_id, summary if "summary" in locals() else {}, final_metadata)
            except Exception:
                pass  # Already logged above

        logger.info(
            "Integrity run completed",
            extra={
                "run_id": run_id,
                "stage": "complete",
                "mode": mode,
                "trigger": trigger,
                "status": status,
                "duration_ms": elapsed_ms,
                "entity_counts": entity_counts,
                "failed_checks": failed_checks,
            },
        )

        result = {
            "run_id": run_id,
            "status": status,
            "duration_ms": elapsed_ms,
            "issues": summary if "summary" in locals() else {},
            "entity_counts": entity_counts,
        }
        if failed_checks:
            result["failed_checks"] = failed_checks
        if error_message:
            result["error_message"] = error_message

        return result

    def _fetch_records(self, mode: str) -> Tuple[Dict[str, List[dict]], Dict[str, int]]:
        """Fetch records, optionally using incremental mode based on last successful run."""
        incremental_since = None
        if mode == "incremental":
            incremental_since = self._firestore_client.get_last_successful_run_timestamp()
            if incremental_since:
                logger.info(
                    "Using incremental fetch",
                    extra={"since": incremental_since.isoformat()},
                )
            else:
                logger.info("No previous successful run found, performing full scan")
        else:
            logger.info("Performing full scan (mode=full)")
        
        fetchers = build_fetchers(self._airtable_client)
        records: Dict[str, List[dict]] = {}
        counts: Dict[str, int] = {}
        for key, fetcher in fetchers.items():
            try:
                data = fetcher.fetch(incremental_since=incremental_since)
                records[key] = data
                counts[key] = len(data)
            except Exception as exc:
                logger.error(f"Failed to fetch {key}", extra={"entity": key, "error": str(exc)}, exc_info=True)
                raise FetchError(key, f"Failed to fetch {key}: {str(exc)}", "unknown") from exc
        return records, counts

    def _execute_checks(self, records: Dict[str, List[dict]]) -> List[IssuePayload]:
        results: List[IssuePayload] = []
        results.extend(duplicates.run(records))
        results.extend(links.run(records, self._schema_config))
        results.extend(required_fields.run(records, self._schema_config))
        results.extend(attendance.run(records, self._runtime_config.attendance_rules))
        return results
