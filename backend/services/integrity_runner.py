"""Orchestrates a single integrity run end-to-end."""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..analyzers import scorer
from ..checks import attendance, duplicates, links, required_fields
from ..clients.airtable import AirtableClient
from ..clients.firestore import FirestoreClient
from ..clients.logging import get_logger, log_check, log_config_load, log_fetch, log_write
from ..config.config_loader import load_runtime_config
from ..config.schema_loader import load_schema_config
from ..config.settings import RuntimeConfig
from ..config.models import SchemaConfig
from ..utils.errors import CheckFailureError, FetchError, IntegrityRunError, WriteError
from ..utils.issues import IssuePayload
from ..fetchers.registry import build_fetchers
from ..utils.timing import timed
from ..writers.firestore_writer import FirestoreWriter
from ..services.feedback_analyzer import get_feedback_analyzer
from ..services.table_id_discovery import discover_table_ids
from ..services.config_updater import update_config
from ..services.status_calculator import calculate_result_status

logger = get_logger(__name__)

# Maximum duration for an integrity run (seconds)
# Runs exceeding this duration will be terminated and marked as "timeout"
MAX_RUN_DURATION_SECONDS = int(os.getenv("MAX_RUN_DURATION_SECONDS", "1800"))  # 30 minutes default


class IntegrityRunner:
    def __init__(
        self,
        runtime_config: RuntimeConfig | None = None,
    ):
        # #region agent log
        import json as _json
        debug_log_path = '/Users/joshuaedwards/Library/CloudStorage/GoogleDrive-jedwards@che.school/My Drive/CHE/che-data-integrity-monitor/.cursor/debug.log'
        try:
            with open(debug_log_path, 'a') as f:
                f.write(_json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"B","location":"integrity_runner.py:33","message":"IntegrityRunner.__init__ entry","data":{"has_runtime_config":runtime_config is not None},"timestamp":int(time.time()*1000)})+'\n')
        except: pass
        # #endregion agent log
        
        # Load config without Firestore overrides first to get Firestore config
        # #region agent log
        try:
            import json as _json
            with open(debug_log_path, 'a') as f:
                f.write(_json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"B","location":"integrity_runner.py:38","message":"Before load_runtime_config","data":{"step":"before_load_runtime_config"},"timestamp":int(time.time()*1000)})+'\n')
        except: pass
        # #endregion agent log
        
        temp_config = runtime_config or load_runtime_config(attempt_discovery=True)
        
        # #region agent log
        try:
            import json as _json
            with open(debug_log_path, 'a') as f:
                f.write(_json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"B","location":"integrity_runner.py:40","message":"After load_runtime_config, before FirestoreClient","data":{"step":"before_firestore_client"},"timestamp":int(time.time()*1000)})+'\n')
        except: pass
        # #endregion agent log
        
        self._firestore_client = FirestoreClient(temp_config.firestore)
        
        # #region agent log
        try:
            import json as _json
            with open(debug_log_path, 'a') as f:
                f.write(_json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"B","location":"integrity_runner.py:42","message":"After FirestoreClient init (lazy, not connected yet)","data":{"step":"after_firestore_client_init"},"timestamp":int(time.time()*1000)})+'\n')
        except: pass
        # #endregion agent log
        
        # Reload config with Firestore client to get overrides
        if runtime_config is None:
            self._runtime_config = load_runtime_config(firestore_client=self._firestore_client, attempt_discovery=True)
        else:
            self._runtime_config = runtime_config
        
        # #region agent log
        try:
            import json as _json
            with open(debug_log_path, 'a') as f:
                f.write(_json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"B","location":"integrity_runner.py:50","message":"After reload config, before schema_config","data":{"step":"before_schema_config"},"timestamp":int(time.time()*1000)})+'\n')
        except: pass
        # #endregion agent log
        
        self._schema_config = load_schema_config(firestore_client=self._firestore_client)
        
        # #region agent log
        try:
            import json as _json
            with open(debug_log_path, 'a') as f:
                f.write(_json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"B","location":"integrity_runner.py:52","message":"After schema_config, before AirtableClient","data":{"step":"before_airtable_client"},"timestamp":int(time.time()*1000)})+'\n')
        except: pass
        # #endregion agent log
        
        self._airtable_client = AirtableClient(self._runtime_config.airtable)
        
        # #region agent log
        try:
            import json as _json
            with open(debug_log_path, 'a') as f:
                f.write(_json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"B","location":"integrity_runner.py:54","message":"After AirtableClient, before FirestoreWriter","data":{"step":"before_firestore_writer"},"timestamp":int(time.time()*1000)})+'\n')
        except: pass
        # #endregion agent log
        
        self._firestore_writer = FirestoreWriter(self._firestore_client)
        
        # #region agent log
        try:
            import json as _json
            with open(debug_log_path, 'a') as f:
                f.write(_json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"B","location":"integrity_runner.py:56","message":"IntegrityRunner.__init__ complete","data":{"step":"after_init"},"timestamp":int(time.time()*1000)})+'\n')
        except: pass
        # #endregion agent log

    def run(
        self,
        run_id: str | None = None,
        trigger: str = "manual",
        cancel_event=None,
        entities: List[str] | None = None,
        run_config: Dict[str, Any] | None = None
    ) -> Dict[str, Any]:
        # Explicitly reference module-level time to avoid UnboundLocalError
        # (Python may treat time as local if used in nested scopes)
        import time as _time_module
        import threading
        # Generate run_id if not provided (for backwards compatibility)
        if run_id is None:
            run_id = str(uuid.uuid4())
        start = _time_module.time()
        start_time = datetime.now(timezone.utc)
        metrics: Dict[str, int] = {}
        entity_counts: Dict[str, int] = {}
        failed_checks: List[str] = []
        status = "running"  # Start with "running" status
        error_message: str | None = None

        logger.info("Integrity run started", extra={"run_id": run_id, "trigger": trigger})
        
        # Store run_id for use in _fetch_records
        self._current_run_id = run_id
        
        # Store selected entities for use in _fetch_records
        # Prefer entities from run_config if provided
        if run_config and run_config.get("entities"):
            self._selected_entities = run_config["entities"]
        else:
            self._selected_entities = entities
        
        # Store run_config for use in filtering
        self._run_config = run_config
        
        # Initialize summary to empty dict so it's always available in finally block
        summary: Dict[str, Any] = {}

        # Setup timeout mechanism
        timeout_triggered = threading.Event()
        timeout_timer = None

        def handle_timeout():
            """Called when run exceeds maximum duration."""
            timeout_triggered.set()
            logger.error(
                "Run exceeded maximum duration",
                extra={"run_id": run_id, "max_duration_seconds": MAX_RUN_DURATION_SECONDS}
            )
            try:
                self._firestore_writer.write_log(
                    run_id,
                    "error",
                    f"Run exceeded maximum duration ({MAX_RUN_DURATION_SECONDS}s) and will be terminated"
                )
            except Exception:
                pass

        # Start timeout timer
        timeout_timer = threading.Timer(MAX_RUN_DURATION_SECONDS, handle_timeout)
        timeout_timer.daemon = True
        timeout_timer.start()
        logger.info(f"Run timeout set to {MAX_RUN_DURATION_SECONDS}s", extra={"run_id": run_id})

        # Helper to check cancellation and timeout
        def check_cancelled():
            # Check timeout first
            if timeout_triggered.is_set():
                raise TimeoutError(f"Run exceeded maximum duration of {MAX_RUN_DURATION_SECONDS} seconds")
            # Then check cancellation
            if cancel_event and cancel_event.is_set():
                status = "cancelled"
                error_message = "Scan cancelled by user"
                try:
                    self._firestore_writer.write_log(run_id, "info", "Scan cancellation detected, stopping...")
                except Exception:
                    pass
                raise IntegrityRunError(
                    run_id=run_id,
                    message=error_message,
                    transient=False,
                )
        
        # Log to Firestore
        try:
            self._firestore_writer.write_log(run_id, "info", f"Integrity run started (trigger: {trigger})")
        except Exception:
            pass  # Non-blocking

        # Auto-discover table IDs and base ID before running scan (non-blocking, fast-fail)
        # This runs synchronously but should complete quickly (< 1s for typical schema files).
        # If it fails or takes too long, we continue with existing config to avoid blocking the scan.
        discovery_result = {}
        try:
            self._firestore_writer.write_log(run_id, "info", "Discovering table IDs from schema...")
            discovery_result = discover_table_ids()
            if discovery_result and discovery_result.get("table_ids"):
                table_count = len(discovery_result.get("table_ids", {}))
                self._firestore_writer.write_log(run_id, "info", f"Discovered {table_count} table ID(s) from schema")
        except Exception as exc:
            logger.warning(
                "Table ID discovery failed, continuing with existing config",
                extra={"run_id": run_id, "error": str(exc)},
            )
            try:
                self._firestore_writer.write_log(run_id, "warning", f"Table ID discovery failed: {str(exc)}")
            except Exception:
                pass
            # Don't fail the run if discovery fails - this is a non-critical optimization
        
        if discovery_result and discovery_result.get("table_ids"):
            table_ids = discovery_result.get("table_ids", {})
            base_id = discovery_result.get("base_id")
            entities = list(table_ids.keys())
            
            logger.info(
                "Discovered IDs before scan",
                extra={
                    "run_id": run_id,
                    "base_id": base_id,
                    "table_count": len(table_ids),
                },
            )
            
            # Update config with discovered IDs (non-blocking, wrapped in try-except)
            # Also set env vars in current process so they're available immediately
            try:
                import os
                from ..services.config_updater import get_env_var_name
                
                # Set base IDs in current process environment (required for all entities)
                if not base_id:
                    logger.error(
                        "Base ID not discovered from schema - cannot set base environment variables",
                        extra={"run_id": run_id},
                    )
                else:
                    # #region agent log
                    import json as _json
                    debug_log_path = '/Users/joshuaedwards/Library/CloudStorage/GoogleDrive-jedwards@che.school/My Drive/CHE/che-data-integrity-monitor/.cursor/debug.log'
                    try:
                        with open(debug_log_path, 'a') as f:
                            f.write(_json.dumps({"sessionId":"debug-session","runId":"scan","hypothesisId":"E","location":"integrity_runner.py:159","message":"Setting base IDs in environment","data":{"base_id":base_id,"entity_count":len(entities)},"timestamp":int(_time_module.time()*1000)})+'\n')
                    except: pass
                    # #endregion agent log
                    
                    for entity in entities:
                        base_var = get_env_var_name(entity, is_base=True)
                        os.environ[base_var] = base_id
                        logger.info(
                            f"Set {base_var}={base_id} in process environment",
                            extra={"run_id": run_id, "entity": entity},
                        )
                        
                        # #region agent log
                        try:
                            import json as _json
                            with open(debug_log_path, 'a') as f:
                                f.write(_json.dumps({"sessionId":"debug-session","runId":"scan","hypothesisId":"E","location":"integrity_runner.py:172","message":"Base ID env var set","data":{"var":base_var,"value":base_id,"verified":os.getenv(base_var)==base_id},"timestamp":int(_time_module.time()*1000)})+'\n')
                        except: pass
                        # #endregion agent log
                
                # Set table IDs in current process environment
                for entity, table_id in table_ids.items():
                    table_var = get_env_var_name(entity, is_base=False)
                    os.environ[table_var] = table_id
                    logger.info(
                        f"Set {table_var}={table_id} in process environment",
                        extra={"run_id": run_id, "entity": entity},
                    )
                
                # Skip .env file updates to avoid triggering uvicorn --reload
                # The environment variables are already set in the current process (above)
                # and will persist for the duration of this scan.
                # Update .env file (fast, local operation)
                # from ..services.config_updater import update_env_file
                # env_results = update_env_file(
                #     table_ids,
                #     base_id=base_id,
                #     entities=entities,
                # )
                # env_updated = sum(1 for v in env_results.values() if v)
                env_updated = 0  # Disabled to prevent reload loop
                
                # Try Firestore update but don't block if it's slow
                fs_updated = 0
                try:
                    from ..services.config_updater import update_firestore_config
                    fs_results = update_firestore_config(
                        table_ids,
                        firestore_client=self._firestore_client,
                    )
                    fs_updated = sum(1 for v in fs_results.values() if v)
                except Exception as fs_exc:
                    logger.debug(
                        "Firestore config update skipped (non-critical)",
                        extra={"run_id": run_id, "error": str(fs_exc)},
                    )
                
                logger.info(
                    "Updated config with discovered IDs",
                    extra={
                        "run_id": run_id,
                        "base_id_set": bool(base_id),
                        "env_updates": env_updated,
                        "firestore_updates": fs_updated,
                    },
                )
                
                # Verify env vars are set before reloading config
                missing_vars = []
                for entity in entities:
                    base_var = get_env_var_name(entity, is_base=True)
                    table_var = get_env_var_name(entity, is_base=False)
                    base_val = os.getenv(base_var)
                    table_val = os.getenv(table_var)
                    
                    # #region agent log
                    try:
                        import json as _json
                        with open(debug_log_path, 'a') as f:
                            f.write(_json.dumps({"sessionId":"debug-session","runId":"scan","hypothesisId":"E","location":"integrity_runner.py:195","message":"Verifying env vars","data":{"entity":entity,"base_var":base_var,"base_set":bool(base_val),"table_var":table_var,"table_set":bool(table_val)},"timestamp":int(_time_module.time()*1000)})+'\n')
                    except: pass
                    # #endregion agent log
                    
                    if base_id and not base_val:
                        missing_vars.append(base_var)
                    if not table_val:
                        missing_vars.append(table_var)
                
                if missing_vars:
                    logger.error(
                        f"Failed to set environment variables: {missing_vars}",
                        extra={"run_id": run_id},
                    )
                    # #region agent log
                    try:
                        import json as _json
                        with open(debug_log_path, 'a') as f:
                            f.write(_json.dumps({"sessionId":"debug-session","runId":"scan","hypothesisId":"E","location":"integrity_runner.py:210","message":"Missing env vars detected","data":{"missing":missing_vars},"timestamp":int(_time_module.time()*1000)})+'\n')
                    except: pass
                    # #endregion agent log
                else:
                    logger.info(
                        f"Successfully set all environment variables for {len(entities)} entities",
                        extra={"run_id": run_id},
                    )
                    # #region agent log
                    try:
                        import json as _json
                        with open(debug_log_path, 'a') as f:
                            f.write(_json.dumps({"sessionId":"debug-session","runId":"scan","hypothesisId":"E","location":"integrity_runner.py:217","message":"All env vars verified","data":{"entity_count":len(entities)},"timestamp":int(_time_module.time()*1000)})+'\n')
                    except: pass
                    # #endregion agent log
                
                # Reload configs dynamically to get latest rules from Firestore
                self._runtime_config = load_runtime_config(firestore_client=self._firestore_client, attempt_discovery=True)
                self._schema_config = load_schema_config(firestore_client=self._firestore_client)
                self._airtable_client = AirtableClient(self._runtime_config.airtable)
                
                logger.info(
                    "Reloaded configs dynamically",
                    extra={"run_id": run_id},
                )
                
            except Exception as exc:
                logger.warning(
                    "Failed to update config with discovered IDs (non-critical)",
                    extra={"run_id": run_id, "error": str(exc)},
                )
                # Continue with scan even if config update fails
        
        # Check for cancellation after discovery
        check_cancelled()

        # Write initial "running" status to Firestore immediately so frontend can see it
        try:
            initial_metadata = {
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
            import time as _time_module
            config_start = _time_module.time()
            config_version = self._runtime_config.metadata.get("config_version") if self._runtime_config else None
            config_duration_ms = int((_time_module.time() - config_start) * 1000)
            log_config_load(logger, run_id, config_duration_ms, config_version)

            # Fetch records
            try:
                entities_param = getattr(self, '_selected_entities', None)
                if entities_param:
                    self._firestore_writer.write_log(run_id, "info", f"Starting to fetch records (entities: {', '.join(entities_param)})...")
                else:
                    self._firestore_writer.write_log(run_id, "info", "Starting to fetch records...")
                with timed("fetch", metrics):
                    records, entity_counts = self._fetch_records(entities_param)
                fetch_duration = metrics.get("duration_fetch", 0)
                total_records = sum(entity_counts.values())
                log_fetch(logger, run_id, entity_counts, fetch_duration)
                self._firestore_writer.write_log(
                    run_id, "info", 
                    f"Fetched {total_records} records from {len(entity_counts)} entities in {(fetch_duration/1000):.1f}s",
                    {"entity_counts": entity_counts, "duration_ms": fetch_duration}
                )
                
                # Check for cancellation after fetching
                check_cancelled()
            except Exception as exc:
                # If it's already a specific CustomError, re-raise it (or wrap it preserving details)
                if isinstance(exc, (FetchError, IntegrityRunError)):
                    raise
                # Otherwise wrap in FetchError
                try:
                    self._firestore_writer.write_log(run_id, "error", f"Failed to fetch records: {str(exc)}")
                except Exception:
                    pass
                raise FetchError("all", str(exc), run_id) from exc

            # Execute checks
            issues: List[IssuePayload] = []
            try:
                # Log entity counts before starting checks
                total_records_count = sum(len(recs) for recs in records.values())
                entity_list = ", ".join(f"{k} ({len(v)})" for k, v in records.items())
                self._firestore_writer.write_log(
                    run_id, "info",
                    f"Running integrity checks on {total_records_count} records across {len(records)} entities: {entity_list}"
                )
                
                with timed("checks", metrics):
                    # Run each check individually with logging
                    check_results: List[IssuePayload] = []
                    
                    # Get filtered schema config if run_config has rule selection
                    schema_config_to_use = self._schema_config
                    if hasattr(self, "_run_config") and self._run_config:
                        schema_config_to_use = self._filter_rules_by_selection(
                            self._schema_config,
                            self._run_config
                        )
                    
                    # Duplicates check
                    import time as _time_module
                    self._firestore_writer.write_log(run_id, "info", "Running duplicates check...")
                    check_start = _time_module.time()
                    dup_issues = duplicates.run(records, schema_config_to_use)
                    check_results.extend(dup_issues)
                    dup_summary = scorer.summarize(dup_issues)
                    dup_duration = int((_time_module.time() - check_start) * 1000)
                    log_check(
                        logger,
                        run_id,
                        "duplicates",
                        len(dup_issues),
                        dup_duration,
                        {k: v for k, v in dup_summary.items() if "duplicate" in k},
                    )
                    self._firestore_writer.write_log(run_id, "info", f"Duplicates check: {len(dup_issues)} issues found in {(dup_duration/1000):.1f}s")
                    check_cancelled()
                    
                    # Links check
                    import time as _time_module
                    self._firestore_writer.write_log(run_id, "info", "Running links check...")
                    check_start = _time_module.time()
                    link_issues = links.run(records, schema_config_to_use)
                    check_results.extend(link_issues)
                    link_summary = scorer.summarize(link_issues)
                    link_duration = int((_time_module.time() - check_start) * 1000)
                    log_check(
                        logger,
                        run_id,
                        "links",
                        len(link_issues),
                        link_duration,
                        {k: v for k, v in link_summary.items() if "link" in k},
                    )
                    self._firestore_writer.write_log(run_id, "info", f"Links check: {len(link_issues)} issues found in {(link_duration/1000):.1f}s")
                    check_cancelled()
                    
                    # Required fields check
                    import time as _time_module
                    self._firestore_writer.write_log(run_id, "info", "Running required fields check...")
                    check_start = _time_module.time()
                    req_issues = required_fields.run(records, schema_config_to_use)
                    check_results.extend(req_issues)
                    req_summary = scorer.summarize(req_issues)
                    req_duration = int((_time_module.time() - check_start) * 1000)
                    log_check(
                        logger,
                        run_id,
                        "required_fields",
                        len(req_issues),
                        req_duration,
                        {k: v for k, v in req_summary.items() if "required" in k},
                    )
                    self._firestore_writer.write_log(run_id, "info", f"Required fields check: {len(req_issues)} issues found in {(req_duration/1000):.1f}s")
                    check_cancelled()
                    
                    # Attendance check
                    attendance_rules_to_use = self._runtime_config.attendance_rules
                    if (hasattr(self, "_run_config") and self._run_config and
                        self._run_config.get("rules") and
                        "attendance_rules" in self._run_config["rules"]):
                        # If attendance_rules is False in selection, skip attendance check
                        if self._run_config["rules"]["attendance_rules"] is False:
                            attendance_rules_to_use = None
                    
                    import time as _time_module
                    if attendance_rules_to_use:
                        self._firestore_writer.write_log(run_id, "info", "Running attendance check...")
                        check_start = _time_module.time()
                        att_issues = attendance.run(records, attendance_rules_to_use)
                        check_results.extend(att_issues)
                        att_summary = scorer.summarize(att_issues)
                        att_duration = int((_time_module.time() - check_start) * 1000)
                        log_check(
                            logger,
                            run_id,
                            "attendance",
                            len(att_issues),
                            att_duration,
                            {k: v for k, v in att_summary.items() if "attendance" in k},
                        )
                        self._firestore_writer.write_log(run_id, "info", f"Attendance check: {len(att_issues)} issues found in {(att_duration/1000):.1f}s")
                    else:
                        att_issues = []
                        self._firestore_writer.write_log(run_id, "info", "Attendance check skipped (not selected in rules)")
                    
                    # Merge and summarize issues
                    issues = check_results
                    total_issues_before_merge = len(issues)
                    self._firestore_writer.write_log(run_id, "info", f"Merging duplicate issues from {total_issues_before_merge} total issues...")
                    merged = scorer.merge(issues)
                    merged_count = len(merged)
                    self._firestore_writer.write_log(run_id, "info", f"Merged to {merged_count} unique issues (removed {total_issues_before_merge - merged_count} duplicates)")
                    
                    self._firestore_writer.write_log(run_id, "info", "Calculating issue summary...")
                    summary = scorer.summarize(merged)
                    total_issues = sum(summary.values())
                    self._firestore_writer.write_log(run_id, "info", f"Prepared {total_issues} total issues for writing")
            except Exception as exc:
                logger.error("Check execution failed catastrophically", extra={"run_id": run_id}, exc_info=True)
                failed_checks.append("all")
                status = "error"  # Catastrophic failure should be error, not warning
                error_message = f"Check execution failed: {str(exc)}"
                # Fail fast - don't continue with empty results when all checks fail
                raise IntegrityRunError(run_id, error_message, transient=False) from exc

            # Always write to Firestore, even on failure
            # Keep status as "running" until all Firestore operations are complete
            try:
                with timed("write_firestore", metrics):
                    # Write initial run metadata with "running" status (will be updated after all operations complete)
                    run_metadata = {
                        "trigger": trigger,
                        "entity_counts": entity_counts,
                        "status": status,  # Still "running" at this point
                        "started_at": start_time,  # Keep original start time
                        "config_version": config_version,
                        **metrics,
                    }
                    if failed_checks:
                        run_metadata["failed_checks"] = failed_checks
                    if error_message:
                        run_metadata["error_message"] = error_message

                    # Update the existing document (merge=True in record_run)
                    # This keeps the status as "running" while operations continue
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
                    
                    # Write metrics if run completed successfully (will check status after all operations)
                    # This will be done after status is calculated below
                    
                    # Write individual issues to Firestore
                    new_issues_count = 0
                    if issues:
                        check_cancelled()  # Check before starting long write operation
                        try:
                            total_issues_to_write = len(merged)
                            self._firestore_writer.write_log(run_id, "info", f"Writing {total_issues_to_write:,} issues to Firestore...")
                            with timed("write_issues_firestore", metrics):
                                new_issues_count = self._firestore_writer.write_issues(merged if issues else [], run_id=run_id)
                            write_issues_duration = metrics.get("duration_write_issues_firestore", 0)
                            updated_count = total_issues_to_write - new_issues_count
                            log_write(logger, run_id, "firestore_issues", total_issues_to_write, write_issues_duration)
                            self._firestore_writer.write_log(run_id, "info", f"Wrote {total_issues_to_write:,} issues to Firestore ({new_issues_count:,} new, {updated_count:,} updated) in {(write_issues_duration/1000):.1f}s")
                        except Exception as exc:
                            logger.error("Failed to write issues to Firestore", extra={"run_id": run_id}, exc_info=True)
                            try:
                                self._firestore_writer.write_log(run_id, "error", f"Failed to write issues to Firestore: {str(exc)}")
                            except Exception:
                                pass
                            # Don't fail the run if issue writing fails
                    
                    # Analyze ignored issues and flag rules (nightly runs only)
                    # Only run feedback analysis if run completed successfully (not failed)
                    # Status check will be done after status is calculated below
                    
                    # NOW calculate final status after all Firestore operations are complete
                    # Only calculate result status if run completed successfully (no technical errors)
                    if (status == "running" or status == "success") and not failed_checks and not error_message:
                        # Calculate result status based on issue counts
                        # summary is from scorer.summarize() - flat dict with keys like "issue_type:severity"
                        summary_for_calc = summary if "summary" in locals() and summary else {}
                        result_status = calculate_result_status(summary_for_calc)
                        logger.info(
                            "Calculated result status",
                            extra={
                                "run_id": run_id,
                                "previous_status": status,
                                "result_status": result_status,
                                "summary_total": sum(summary_for_calc.values()) if summary_for_calc else 0,
                            },
                        )
                        status = result_status
                    
                    # Write metrics if run completed successfully (healthy, warning, or critical - not failed)
                    if status in ("healthy", "warning", "critical", "success"):
                        try:
                            metrics_payload = {**summary, **entity_counts}
                            self._firestore_writer.write_metrics(metrics_payload)
                        except Exception as exc:
                            logger.warning(
                                "Failed to write metrics to Firestore",
                                extra={"run_id": run_id, "error": str(exc)},
                            )
                    
                    # Analyze ignored issues and flag rules (nightly runs only)
                    # Only run feedback analysis if run completed successfully (not failed)
                    if trigger == "nightly" and status in ("healthy", "warning", "critical", "success"):
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
                    
                    # Write final status to Firestore now that all operations are complete
                    final_metadata = {
                        "trigger": trigger,
                        "entity_counts": entity_counts,
                        "status": status,  # Final calculated status
                        "started_at": start_time,
                        "config_version": config_version,
                        **metrics,
                    }
                    if failed_checks:
                        final_metadata["failed_checks"] = failed_checks
                    if error_message:
                        final_metadata["error_message"] = error_message
                    
                    try:
                        self._firestore_writer.write_run(run_id, summary, final_metadata)
                    except Exception as exc:
                        logger.error(
                            "Failed to write final status to Firestore",
                            extra={"run_id": run_id, "error": str(exc)},
                            exc_info=True,
                        )
            except Exception as exc:
                logger.error("Firestore write failed", extra={"run_id": run_id}, exc_info=True)
                # This is critical - log but don't fail the run
                error_message = (error_message or "") + f" Firestore write failed: {str(exc)}"

        except TimeoutError as exc:
            status = "timeout"
            error_message = str(exc)
            logger.error(
                "Integrity run exceeded maximum duration",
                extra={"run_id": run_id, "max_duration_seconds": MAX_RUN_DURATION_SECONDS},
                exc_info=True,
            )
            try:
                self._firestore_writer.write_log(run_id, "error", f"Run timed out: {error_message}")
            except Exception:
                pass
            # Write timeout status to Firestore
            try:
                run_metadata = {
                    "status": status,
                    "started_at": start_time,
                    "ended_at": datetime.now(timezone.utc),
                    "error_message": error_message,
                    **metrics,
                }
                self._firestore_writer.write_run(run_id, {}, run_metadata)
            except Exception:
                logger.error("Failed to write timeout status to Firestore", extra={"run_id": run_id})

        except IntegrityRunError as exc:
            status = "error"
            error_message = str(exc)
            logger.error(
                "Integrity run failed",
                extra={"run_id": run_id, "error": error_message},
                exc_info=True,
            )
            try:
                self._firestore_writer.write_log(run_id, "error", f"Scan failed: {error_message}")
            except Exception:
                pass
            # Still try to write status to Firestore
            try:
                run_metadata = {
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
            import time as _time_module

            # Cancel timeout timer if it's still running
            if timeout_timer is not None:
                timeout_timer.cancel()

            elapsed_ms = int((_time_module.time() - start) * 1000)
            end_time = datetime.now(timezone.utc)

            # Clear run_id reference
            if hasattr(self, '_current_run_id'):
                delattr(self, '_current_run_id')

            # Ensure status is not "running" before writing final status
            # This acts as a safety net in case status wasn't set earlier
            # Only calculate result status if run completed successfully (no technical errors)
            if status == "running" and not failed_checks and not error_message:
                # Calculate result status based on issue counts
                # summary may be empty dict if no issues found, which is fine - will return "healthy"
                result_status = calculate_result_status(summary if "summary" in locals() else {})
                status = result_status

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
                # Include new_issues_count if it was captured
                if "new_issues_count" in locals():
                    final_metadata["new_issues_count"] = new_issues_count
                # Write summary (will only update counts if summary has content, preserving existing counts if empty)
                self._firestore_writer.write_run(run_id, summary, final_metadata)
            except Exception:
                pass  # Already logged above

        logger.info(
            "Integrity run completed",
            extra={
                "run_id": run_id,
                "stage": "complete",
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

    def _fetch_records(self, entities: List[str] | None = None) -> Tuple[Dict[str, List[dict]], Dict[str, int]]:
        """Fetch records for the specified entities.
        
        Args:
            entities: Optional list of entity names to fetch. If None, fetches all entities.
        """
        logger.info("Performing full scan")
        
        fetchers = build_fetchers(self._airtable_client)
        
        # Filter fetchers by selected entities if provided
        if entities:
            fetchers = {key: fetcher for key, fetcher in fetchers.items() if key in entities}
            logger.info(f"Filtered to {len(fetchers)} entities: {', '.join(entities)}")
        
        records: Dict[str, List[dict]] = {}
        counts: Dict[str, int] = {}
        for key, fetcher in fetchers.items():
            try:
                # Extract run_id from logger context if available
                run_id = None
                if hasattr(self, '_current_run_id'):
                    run_id = self._current_run_id
                elif hasattr(logger, 'extra') and logger.extra:
                    run_id = logger.extra.get('run_id')
                
                if run_id:
                    try:
                        self._firestore_writer.write_log(run_id, "info", f"Fetching {key} records...")
                    except Exception:
                        pass
                
                # Create progress callback that writes to Firestore logs
                def log_progress(message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
                    if run_id:
                        try:
                            self._firestore_writer.write_log(run_id, "info", message, metadata)
                        except Exception:
                            pass
                
                data = fetcher.fetch(progress_callback=log_progress if run_id else None)
                records[key] = data
                counts[key] = len(data)
                
                if run_id:
                    try:
                        self._firestore_writer.write_log(run_id, "info", f"Fetched {len(data)} {key} records")
                    except Exception:
                        pass
            except Exception as exc:
                run_id = None
                if hasattr(self, '_current_run_id'):
                    run_id = self._current_run_id
                elif hasattr(logger, 'extra') and logger.extra:
                    run_id = logger.extra.get('run_id')
                
                if run_id:
                    try:
                        self._firestore_writer.write_log(run_id, "error", f"Failed to fetch {key}: {str(exc)}")
                    except Exception:
                        pass
                
                logger.error(f"Failed to fetch {key}", extra={"entity": key, "error": str(exc)}, exc_info=True)
                raise FetchError(key, f"Failed to fetch {key}: {str(exc)}", "unknown") from exc
        return records, counts

    def _filter_rules_by_selection(
        self, schema_config: SchemaConfig, run_config: Dict[str, Any] | None
    ) -> SchemaConfig:
        """Filter SchemaConfig based on selected rules in run_config.
        
        Validates that selected rule IDs exist in the current schema and logs
        warnings for any missing rules.
        
        Args:
            schema_config: Original SchemaConfig
            run_config: Run configuration with optional rules selection
            
        Returns:
            Filtered SchemaConfig with only selected rules that exist
        """
        if not run_config or not run_config.get("rules"):
            # No rule filtering requested, return original
            return schema_config
        
        rules_selection = run_config["rules"]
        
        # Create a copy to avoid modifying the original
        from copy import deepcopy
        filtered_config = deepcopy(schema_config)
        
        # Track missing rules for logging
        missing_rules = []
        
        # Filter duplicates
        # If duplicates key exists in selection, filter based on selection
        # If it doesn't exist, clear ALL duplicate rules (user didn't select any)
        if "duplicates" in rules_selection:
            selected_dup = rules_selection.get("duplicates", {})
            if selected_dup:
                # User selected specific duplicate rules
                for entity, rule_ids in selected_dup.items():
                    if entity not in filtered_config.duplicates:
                        missing_rules.extend([
                            f"duplicates.{entity}.{rule_id}" 
                            for rule_id in rule_ids
                        ])
                        continue
                        
                    dup_def = filtered_config.duplicates[entity]
                    # Get all existing rule IDs for validation
                    existing_rule_ids = {
                        rule.rule_id for rule in (dup_def.likely or []) + (dup_def.possible or [])
                    }
                    
                    # Check for missing rule IDs
                    for rule_id in rule_ids:
                        if rule_id not in existing_rule_ids:
                            missing_rules.append(f"duplicates.{entity}.{rule_id}")
                    
                    # Filter likely rules
                    dup_def.likely = [
                        rule for rule in (dup_def.likely or [])
                        if rule.rule_id in rule_ids
                    ]
                    # Filter possible rules
                    dup_def.possible = [
                        rule for rule in (dup_def.possible or [])
                        if rule.rule_id in rule_ids
                    ]
                
                # Clear duplicates for entities not in selection
                for entity in list(filtered_config.duplicates.keys()):
                    if entity not in selected_dup:
                        del filtered_config.duplicates[entity]
            else:
                # User selected duplicates category but no specific rules - clear all
                filtered_config.duplicates = {}
        else:
            # Key absent = user didn't select any duplicates - clear all
            filtered_config.duplicates = {}
        
        # Filter relationships
        # If relationships key exists in selection, filter based on selection
        # If it doesn't exist, clear ALL relationships (user didn't select any)
        if "relationships" in rules_selection:
            selected_rel = rules_selection.get("relationships", {})
            if selected_rel:
                # User selected specific relationship rules
                for entity, rel_keys in selected_rel.items():
                    if entity not in filtered_config.entities:
                        missing_rules.extend([
                            f"relationships.{entity}.{key}" 
                            for key in rel_keys
                        ])
                        continue
                        
                    entity_schema = filtered_config.entities[entity]
                    # Get all existing relationship keys
                    existing_keys = set(entity_schema.relationships.keys())
                    
                    # Check for missing keys
                    for key in rel_keys:
                        if key not in existing_keys:
                            missing_rules.append(f"relationships.{entity}.{key}")
                    
                    # Filter relationships dict to only include selected keys that exist
                    entity_schema.relationships = {
                        key: rule
                        for key, rule in entity_schema.relationships.items()
                        if key in rel_keys
                    }
                
                # Clear relationships for entities not in selection
                for entity in filtered_config.entities:
                    if entity not in selected_rel:
                        filtered_config.entities[entity].relationships = {}
            else:
                # User selected relationships category but no specific rules - clear all
                for entity in filtered_config.entities:
                    filtered_config.entities[entity].relationships = {}
        else:
            # Key absent = user didn't select any relationships - clear all
            for entity in filtered_config.entities:
                filtered_config.entities[entity].relationships = {}
        
        # Filter required fields
        # If required_fields key exists in selection, filter based on selection
        # If it doesn't exist, clear ALL required fields (user didn't select any)
        if "required_fields" in rules_selection:
            selected_req = rules_selection.get("required_fields", {})
            if selected_req:
                # User selected specific required field rules
                for entity, rule_ids in selected_req.items():
                    if entity not in filtered_config.entities:
                        missing_rules.extend([
                            f"required_fields.{entity}.{rule_id}" 
                            for rule_id in rule_ids
                        ])
                        continue
                        
                    entity_schema = filtered_config.entities[entity]
                    # Get all existing rule identifiers
                    existing_identifiers = set()
                    for req in (entity_schema.missing_key_data or []):
                        existing_identifiers.add(req.field)
                        existing_identifiers.add(f"required.{entity}.{req.field}")
                        if hasattr(req, "rule_id") and req.rule_id:
                            existing_identifiers.add(req.rule_id)
                    
                    # Check for missing rule IDs
                    for rule_id in rule_ids:
                        if rule_id not in existing_identifiers:
                            missing_rules.append(f"required_fields.{entity}.{rule_id}")
                    
                    # Filter missing_key_data array
                    entity_schema.missing_key_data = [
                        req for req in (entity_schema.missing_key_data or [])
                        if (req.field in rule_ids or
                            f"required.{entity}.{req.field}" in rule_ids or
                            getattr(req, "rule_id", None) in rule_ids)
                    ]
                
                # Clear required fields for entities not in selection
                for entity in filtered_config.entities:
                    if entity not in selected_req:
                        filtered_config.entities[entity].missing_key_data = []
            else:
                # User selected required_fields category but no specific rules - clear all
                for entity in filtered_config.entities:
                    filtered_config.entities[entity].missing_key_data = []
        else:
            # Key absent = user didn't select any required fields - clear all
            for entity in filtered_config.entities:
                filtered_config.entities[entity].missing_key_data = []
        
        # Log warnings for missing rules
        if missing_rules:
            logger.warning(
                "Some selected rules no longer exist in the current schema and will be ignored",
                extra={
                    "missing_rules": missing_rules,
                    "run_config_has_rules": bool(rules_selection),
                }
            )
        
        # Note: attendance_rules is handled separately in attendance.run()
        # since it's not part of SchemaConfig
        
        return filtered_config
    
    def _execute_checks(self, records: Dict[str, List[dict]]) -> List[IssuePayload]:
        # Get filtered schema config if run_config has rule selection
        schema_config_to_use = self._schema_config
        if hasattr(self, "_run_config") and self._run_config:
            schema_config_to_use = self._filter_rules_by_selection(
                self._schema_config,
                self._run_config
            )
        
        results: List[IssuePayload] = []
        results.extend(duplicates.run(records, schema_config_to_use))
        results.extend(links.run(records, schema_config_to_use))
        results.extend(required_fields.run(records, schema_config_to_use))
        
        # Handle attendance rules filtering
        attendance_rules_to_use = self._runtime_config.attendance_rules
        if (hasattr(self, "_run_config") and self._run_config and
            self._run_config.get("rules") and
            "attendance_rules" in self._run_config["rules"]):
            # If attendance_rules is False in selection, skip attendance check
            if self._run_config["rules"]["attendance_rules"] is False:
                attendance_rules_to_use = None
        
        if attendance_rules_to_use:
            results.extend(attendance.run(records, attendance_rules_to_use))
        
        return results
