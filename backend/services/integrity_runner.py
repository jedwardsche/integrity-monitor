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
        
        self._schema_config = load_schema_config()
        
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

    def run(self, run_id: str | None = None, mode: str = "incremental", trigger: str = "manual", cancel_event=None, entities: List[str] | None = None) -> Dict[str, Any]:
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

        logger.info("Integrity run started", extra={"run_id": run_id, "mode": mode, "trigger": trigger})
        
        # Store run_id for use in _fetch_records
        self._current_run_id = run_id
        
        # Store selected entities for use in _fetch_records
        self._selected_entities = entities
        
        # Initialize summary to empty dict so it's always available in finally block
        summary: Dict[str, Any] = {}
        
        # Helper to check cancellation
        def check_cancelled():
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
            self._firestore_writer.write_log(run_id, "info", f"Integrity run started (mode: {mode}, trigger: {trigger})")
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
                
                # Reload runtime config to pick up new env vars
                self._runtime_config = load_runtime_config(firestore_client=self._firestore_client, attempt_discovery=True)
                self._airtable_client = AirtableClient(self._runtime_config.airtable)
                
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
            import time as _time_module
            config_start = _time_module.time()
            config_version = self._runtime_config.metadata.get("config_version") if self._runtime_config else None
            config_duration_ms = int((_time_module.time() - config_start) * 1000)
            log_config_load(logger, run_id, config_duration_ms, config_version)

            # Fetch records
            try:
                entities_param = getattr(self, '_selected_entities', None)
                if entities_param:
                    self._firestore_writer.write_log(run_id, "info", f"Starting to fetch records (mode: {mode}, entities: {', '.join(entities_param)})...")
                else:
                    self._firestore_writer.write_log(run_id, "info", f"Starting to fetch records (mode: {mode})...")
                with timed("fetch", metrics):
                    records, entity_counts = self._fetch_records(mode, entities_param)
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
                self._firestore_writer.write_log(run_id, "info", "Running integrity checks...")
                with timed("checks", metrics):
                    # Run each check individually with logging
                    check_results: List[IssuePayload] = []
                    
                    # Duplicates check
                    import time as _time_module
                    self._firestore_writer.write_log(run_id, "info", "Running duplicates check...")
                    check_start = _time_module.time()
                    dup_issues = duplicates.run(records)
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
                    link_issues = links.run(records, self._schema_config)
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
                    req_issues = required_fields.run(records, self._schema_config)
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
                    import time as _time_module
                    self._firestore_writer.write_log(run_id, "info", "Running attendance check...")
                    check_start = _time_module.time()
                    att_issues = attendance.run(records, self._runtime_config.attendance_rules)
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
                        check_cancelled()  # Check before starting long write operation
                        try:
                            self._firestore_writer.write_log(run_id, "info", f"Writing {len(merged):,} issues to Firestore...")
                            with timed("write_issues_firestore", metrics):
                                self._firestore_writer.write_issues(merged if issues else [], run_id=run_id)
                            write_issues_duration = metrics.get("duration_write_issues_firestore", 0)
                            log_write(logger, run_id, "firestore_issues", len(merged) if issues else 0, write_issues_duration)
                            self._firestore_writer.write_log(run_id, "info", f"Wrote {len(merged):,} issues to Firestore in {(write_issues_duration/1000):.1f}s")
                        except Exception as exc:
                            logger.error("Failed to write issues to Firestore", extra={"run_id": run_id}, exc_info=True)
                            try:
                                self._firestore_writer.write_log(run_id, "error", f"Failed to write issues to Firestore: {str(exc)}")
                            except Exception:
                                pass
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
                    
                    # Determine final status after all operations complete
                    if status == "running" and not failed_checks and not error_message:
                        status = "success"
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
            try:
                self._firestore_writer.write_log(run_id, "error", f"Scan failed: {error_message}")
            except Exception:
                pass
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
            import time as _time_module
            elapsed_ms = int((_time_module.time() - start) * 1000)
            end_time = datetime.now(timezone.utc)
            
            # Clear run_id reference
            if hasattr(self, '_current_run_id'):
                delattr(self, '_current_run_id')

            # Ensure status is not "running" before writing final status
            # This acts as a safety net in case status wasn't set earlier
            if status == "running" and not failed_checks and not error_message:
                status = "success"

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
                # Write summary (will only update counts if summary has content, preserving existing counts if empty)
                self._firestore_writer.write_run(run_id, summary, final_metadata)
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

    def _fetch_records(self, mode: str, entities: List[str] | None = None) -> Tuple[Dict[str, List[dict]], Dict[str, int]]:
        """Fetch records, optionally using incremental mode based on last successful run.
        
        Args:
            mode: Scan mode ("incremental" or "full")
            entities: Optional list of entity names to fetch. If None, fetches all entities.
        """
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
                
                data = fetcher.fetch(incremental_since=incremental_since)
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

    def _execute_checks(self, records: Dict[str, List[dict]]) -> List[IssuePayload]:
        results: List[IssuePayload] = []
        results.extend(duplicates.run(records))
        results.extend(links.run(records, self._schema_config))
        results.extend(required_fields.run(records, self._schema_config))
        results.extend(attendance.run(records, self._runtime_config.attendance_rules))
        return results
