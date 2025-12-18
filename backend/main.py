import logging
import os
import json
import time
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Request, status, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

# #region agent log
# Debug log path - only used in local development
debug_log = Path(__file__).parent.parent / ".cursor" / "debug.log"
try:
    if debug_log.parent.exists():
        with open(debug_log, 'a') as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"A","location":"main.py:1","message":"Module import started","data":{"step":"import_start"},"timestamp":int(time.time()*1000)})+'\n')
except: pass
# #endregion agent log

# Load environment variables from backend/.env
from dotenv import load_dotenv
backend_dir = Path(__file__).parent
load_dotenv(backend_dir / ".env")

# #region agent log
try:
    with open(debug_log, 'a') as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"A","location":"main.py:12","message":"After dotenv load","data":{"step":"after_dotenv"},"timestamp":int(time.time()*1000)})+'\n')
except: pass
# #endregion agent log

# #region agent log
try:
    with open(debug_log, 'a') as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"A","location":"main.py:13","message":"Before imports","data":{"step":"before_imports"},"timestamp":int(time.time()*1000)})+'\n')
except: pass
# #endregion agent log

from .config.schema_loader import load_schema_config

# #region agent log
try:
    with open(debug_log, 'a') as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"A","location":"main.py:16","message":"After schema_loader import","data":{"step":"after_schema_loader"},"timestamp":int(time.time()*1000)})+'\n')
except: pass
# #endregion agent log

from .middleware.auth import verify_bearer_token, verify_cloud_scheduler_auth, verify_firebase_token

# #region agent log
try:
    with open(debug_log, 'a') as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"A","location":"main.py:19","message":"After auth import","data":{"step":"after_auth"},"timestamp":int(time.time()*1000)})+'\n')
except: pass
# #endregion agent log

from .services.integrity_runner import IntegrityRunner

# #region agent log
try:
    with open(debug_log, 'a') as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"A","location":"main.py:22","message":"After IntegrityRunner import","data":{"step":"after_integrity_runner_import"},"timestamp":int(time.time()*1000)})+'\n')
except: pass
# #endregion agent log

from .services.airtable_schema_service import schema_service
from .services.integrity_metrics_service import get_metrics_service
from .services.table_id_discovery import discover_table_ids, validate_discovered_ids
from .services.config_updater import update_config
from .utils.errors import IntegrityRunError

logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration - restrict origins in production
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_credentials=True if allowed_origins != ["*"] else False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add request ID to logs for tracing."""

    async def dispatch(self, request: Request, call_next):
        import uuid
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


app.add_middleware(RequestIDMiddleware)

# #region agent log
try:
    with open(debug_log, 'a') as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"A","location":"main.py:104","message":"Starting schema config load","data":{"step":"before_load_schema_config"},"timestamp":int(time.time()*1000)})+'\n')
except: pass
# #endregion agent log

# Load schema config with error handling
try:
    schema_config = load_schema_config()
    logger.info("Schema config loaded successfully")
except Exception as e:
    logger.error(f"Failed to load schema config: {e}", exc_info=True)
    # Create a minimal schema config to allow app to start
    from .config.models import SchemaConfig
    schema_config = SchemaConfig(entities={})
    logger.warning("Using empty schema config due to load failure")

# #region agent log
try:
    with open(debug_log, 'a') as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"B","location":"main.py:120","message":"Schema config loaded, starting IntegrityRunner init","data":{"step":"before_integrity_runner","schema_loaded":True},"timestamp":int(time.time()*1000)})+'\n')
except: pass
# #endregion agent log

# Initialize IntegrityRunner with error handling
try:
    runner = IntegrityRunner()
    logger.info("IntegrityRunner initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize IntegrityRunner: {e}", exc_info=True)
    # Set runner to None - endpoints that need it will handle the error
    runner = None
    logger.warning("IntegrityRunner not available - some endpoints may fail")

# Global dictionary to track running scans: {run_id: threading.Event}
running_scans: dict[str, threading.Event] = {}
running_scans_lock = threading.Lock()

# #region agent log
try:
    with open(debug_log, 'a') as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"startup","hypothesisId":"C","location":"main.py:135","message":"Startup complete","data":{"step":"after_integrity_runner","runner_available":runner is not None},"timestamp":int(time.time()*1000)})+'\n')
except: pass
# #endregion agent log

logger.info("FastAPI application startup complete")


@app.on_event("startup")
async def startup_event():
    """Log when the application is ready to accept requests."""
    import sys
    logger.info(
        "Application startup event triggered",
        extra={
            "python_version": sys.version,
            "port": os.getenv("PORT", "8080"),
            "runner_available": runner is not None,
            "schema_loaded": schema_config is not None,
        }
    )


@app.on_event("shutdown")
async def shutdown_event():
    """Log when the application is shutting down."""
    logger.info("Application shutdown event triggered")


@app.get("/health")
def health():
    """Health check endpoint - should always respond even if other services fail."""
    return {
        "status": "ok",
        "runner_available": runner is not None,
        "schema_loaded": schema_config is not None,
    }


@app.get("/auth/dev-token")
def get_dev_token(email: str = "jedwards@che.school"):
    """Generate a custom Firebase auth token for development.
    
    WARNING: This endpoint should only be enabled in development environments.
    It allows bypassing normal authentication.
    
    Args:
        email: Email address to generate token for (default: jedwards@che.school)
    
    Returns:
        Dictionary with custom token
    """
    import os
    
    # Only allow in development
    if os.getenv("ENVIRONMENT", "dev") not in ["dev", "development", "local"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev token endpoint not available in production",
        )
    
    try:
        # Try to use Firebase Admin SDK to create custom token
        try:
            import firebase_admin
            from firebase_admin import auth as admin_auth, credentials
        except ImportError as import_err:
            # Firebase Admin SDK not installed - return error
            logger.error("Firebase Admin SDK import failed", extra={"error": str(import_err)}, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Firebase Admin SDK not available. Install with: pip install firebase-admin. Error: {str(import_err)}",
            )
        
        # Initialize Firebase Admin if not already initialized
        try:
            if not firebase_admin._apps:
                # Try to get credentials from environment
                cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                if cred_path:
                    # Resolve relative paths relative to backend directory
                    if not os.path.isabs(cred_path):
                        # Get backend directory (where this file is located)
                        backend_dir = os.path.dirname(os.path.abspath(__file__))
                        cred_path = os.path.join(backend_dir, cred_path)
                        # Also try resolving relative to current working directory
                        if not os.path.exists(cred_path):
                            cred_path = os.path.abspath(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
                    
                    if os.path.exists(cred_path):
                        cred = credentials.Certificate(cred_path)
                        # Get project ID from credentials for logging
                        import json
                        with open(cred_path, 'r') as f:
                            sa_data = json.load(f)
                            project_id = sa_data.get('project_id', 'unknown')
                        firebase_admin.initialize_app(cred, {'projectId': project_id})
                        logger.info("Firebase Admin initialized", extra={"path": cred_path, "project_id": project_id})
                    else:
                        logger.warning(f"Service account file not found at {cred_path}, trying default credentials")
                        cred = credentials.ApplicationDefault()
                        firebase_admin.initialize_app(cred)
                else:
                    # Use default credentials (for Cloud Run, etc.)
                    try:
                        cred = credentials.ApplicationDefault()
                        firebase_admin.initialize_app(cred)
                    except Exception as cred_err:
                        logger.error("Failed to initialize Firebase with default credentials", extra={"error": str(cred_err)}, exc_info=True)
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to initialize Firebase Admin. Set GOOGLE_APPLICATION_CREDENTIALS or ensure default credentials are available. Error: {str(cred_err)}",
                        )
        except ValueError as ve:
            # App already initialized
            if "already exists" not in str(ve).lower():
                raise
        
        # Get the project ID being used for better error messages
        try:
            app = firebase_admin.get_app()
            project_id = app.project_id if hasattr(app, 'project_id') else 'unknown'
        except:
            project_id = 'unknown'
        
        # Get user by email to get UID, or create user if doesn't exist
        try:
            user = admin_auth.get_user_by_email(email)
            uid = user.uid
            logger.info("Found existing user", extra={"email": email, "uid": uid})
        except admin_auth.UserNotFoundError:
            # Create user if doesn't exist
            try:
                user = admin_auth.create_user(email=email)
                uid = user.uid
                logger.info("Created new user", extra={"email": email, "uid": uid})
            except Exception as create_err:
                error_msg = str(create_err)
                logger.error("Failed to create user", extra={"email": email, "error": error_msg, "project_id": project_id}, exc_info=True)
                
                # Check if it's a configuration error
                if "CONFIGURATION_NOT_FOUND" in error_msg or "ConfigurationNotFoundError" in str(type(create_err).__name__):
                    detail_msg = (
                        f"Firebase Authentication API is not enabled for project '{project_id}'. "
                        f"Please verify:\n"
                        f"1. Go to https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project={project_id}\n"
                        f"2. Ensure the API shows as 'Enabled' (may take 1-2 minutes to propagate)\n"
                        f"3. Verify Firebase Authentication is enabled in Firebase Console: https://console.firebase.google.com/project/{project_id}/authentication\n"
                        f"4. Enable Email/Password sign-in method in Firebase Console\n"
                        f"5. Ensure your service account has 'Firebase Admin SDK Administrator Service Agent' role"
                    )
                else:
                    detail_msg = f"Failed to create user: {error_msg}"
                
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=detail_msg,
                )
        except Exception as lookup_err:
            # Handle ConfigurationNotFoundError or other lookup errors
            error_str = str(lookup_err)
            if "CONFIGURATION_NOT_FOUND" in error_str or "ConfigurationNotFoundError" in str(type(lookup_err).__name__):
                # Try creating user directly - might work if Auth is partially configured
                try:
                    user = admin_auth.create_user(email=email)
                    uid = user.uid
                    logger.info("Created user after configuration error", extra={"email": email, "uid": uid})
                except Exception as create_err:
                    error_msg = str(create_err)
                    logger.error("Failed to create user after configuration error", extra={"email": email, "error": error_msg, "project_id": project_id}, exc_info=True)
                    
                    # Provide more specific guidance based on error
                    if "CONFIGURATION_NOT_FOUND" in error_msg or "ConfigurationNotFoundError" in str(type(create_err).__name__):
                        detail_msg = (
                            f"Firebase Authentication API is not enabled for project '{project_id}'. "
                            f"Please verify:\n"
                            f"1. Go to https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project={project_id}\n"
                            f"2. Ensure the API shows as 'Enabled' (may take 1-2 minutes to propagate)\n"
                            f"3. Verify Firebase Authentication is enabled in Firebase Console: https://console.firebase.google.com/project/{project_id}/authentication\n"
                            f"4. Enable Email/Password sign-in method in Firebase Console\n"
                            f"5. Ensure your service account has 'Firebase Admin SDK Administrator Service Agent' role"
                        )
                    else:
                        detail_msg = f"Failed to create user: {error_msg}"
                    
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=detail_msg,
                    )
            else:
                # Re-raise other lookup errors
                raise
        
        # Create custom token using UID
        custom_token = admin_auth.create_custom_token(uid)
        return {"token": custom_token.decode() if isinstance(custom_token, bytes) else custom_token}
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as exc:
        logger.error("Failed to generate dev token", extra={"email": email, "error": str(exc)}, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate dev token: {str(exc)}",
        )


@app.get("/schema", dependencies=[Depends(verify_bearer_token)])
def schema():
    """Expose the current schema configuration (requires authentication)."""
    if schema_config is None:
        raise HTTPException(status_code=500, detail="Schema config not loaded")
    return schema_config.model_dump()


def _run_integrity_background(run_id: str, mode: str, trigger: str, cancel_event: threading.Event, entities: list[str] = None):
    """Run integrity scan in background thread."""
    try:
        # Create a new runner instance for this thread
        if runner is None:
            logger.error("IntegrityRunner not available - cannot start scan", extra={"run_id": run_id})
            return
        thread_runner = IntegrityRunner()
        result = thread_runner.run(run_id=run_id, mode=mode, trigger=trigger, cancel_event=cancel_event, entities=entities)
        logger.info(
            "Integrity run completed",
            extra={"run_id": run_id, "status": result.get("status", "success")},
        )
    except Exception as exc:
        logger.error(
            "Integrity run failed",
            extra={"run_id": run_id, "error": str(exc)},
            exc_info=True,
        )
    finally:
        # Clean up running scan tracking
        with running_scans_lock:
            running_scans.pop(run_id, None)


@app.post("/integrity/run", dependencies=[Depends(verify_cloud_scheduler_auth)])
def run_integrity(request: Request, mode: str = "incremental", trigger: str = "manual", entities: Optional[List[str]] = Query(default=None)):
    """Trigger the integrity runner (runs in background).

    Args:
        request: FastAPI request object (injected)
        mode: Run mode ("incremental" or "full")
        trigger: Trigger source ("nightly", "weekly", or "manual")
        entities: Optional list of entity names to scan (if not provided, scans all entities)

    Returns:
        - 200: Success with run_id (scan runs in background)
        - 500: Complete system failure (unable to start run)
    """
    # Get request ID from middleware
    request_id = getattr(request.state, "request_id", "unknown")
    logger.info("Integrity run requested", extra={"mode": mode, "trigger": trigger, "entities": entities, "request_id": request_id})

    try:
        # Generate run_id first
        import uuid
        run_id = str(uuid.uuid4())
        
        # Create cancellation event for this run
        cancel_event = threading.Event()
        
        # Store in running scans
        with running_scans_lock:
            running_scans[run_id] = cancel_event
        
        # Start background thread
        thread = threading.Thread(
            target=_run_integrity_background,
            args=(run_id, mode, trigger, cancel_event, entities),
            daemon=True,
        )
        thread.start()
        
        logger.info("Integrity run started in background", extra={"run_id": run_id, "request_id": request_id})
        
        # Return immediately with run_id
        return {
            "run_id": run_id,
            "status": "running",
            "message": "Scan started in background",
        }
        
    except Exception as exc:
        logger.error(
            "Failed to start integrity run",
            extra={"error": str(exc), "request_id": request_id},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Failed to start integrity run", "message": str(exc)},
        )


@app.post("/integrity/run/{run_id}/cancel", dependencies=[Depends(verify_cloud_scheduler_auth)])
def cancel_integrity_run(run_id: str, request: Request):
    """Cancel a running integrity scan.
    
    Args:
        run_id: Run identifier to cancel
        request: FastAPI request object (injected)
    
    Returns:
        - 200: Success (run cancelled or not found)
        - 404: Run not found or already completed
    """
    request_id = getattr(request.state, "request_id", "unknown")
    logger.info("Integrity run cancellation requested", extra={"run_id": run_id, "request_id": request_id})
    
    # Try to cancel via in-memory event first (if run is in current process)
    with running_scans_lock:
        cancel_event = running_scans.get(run_id)
        if cancel_event:
            # Set cancellation event
            cancel_event.set()
            logger.info("Integrity run cancellation signal sent", extra={"run_id": run_id, "request_id": request_id})
    
    # Always update Firestore status (works even if run is in different process/server)
    try:
        from .clients.firestore import FirestoreClient
        from .config.config_loader import load_runtime_config
        from .writers.firestore_writer import FirestoreWriter
        
        config = load_runtime_config()
        firestore_client = FirestoreClient(config.firestore)
        
        # Check if run exists and is still running by querying Firestore directly
        client = firestore_client._get_client()
        doc_ref = client.collection(config.firestore.runs_collection).document(run_id)
        run_doc = doc_ref.get()
        
        if not run_doc.exists:
            logger.warning("Run not found in Firestore", extra={"run_id": run_id, "request_id": request_id})
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "Run not found", "run_id": run_id},
            )
        
        run_data = run_doc.to_dict()
        
        # Check if run is already completed
        # Only check status, not ended_at, since ended_at might be set incorrectly
        # or in a race condition while status is still "running"
        run_status = run_data.get("status", "").lower()
        completed_statuses = ["success", "error", "warning", "cancelled", "canceled", "healthy"]
        if run_status in completed_statuses:
            logger.info("Run already completed, cannot cancel", extra={"run_id": run_id, "status": run_data.get("status"), "request_id": request_id})
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "Run already completed", "message": f"Run has already completed with status: {run_data.get('status')}", "run_id": run_id, "status": run_data.get("status")},
            )
        
        # If status is missing or empty, treat as running (allow cancellation)
        # This handles edge cases where status wasn't set properly
        
        # Calculate duration from start time to now
        started_at = run_data.get("started_at")
        end_time = datetime.now(timezone.utc)
        
        duration_ms = 0
        if started_at:
            try:
                # Convert Firestore timestamp to datetime
                start_dt = None
                
                # Check if it's a Firestore Timestamp object
                if hasattr(started_at, 'timestamp'):
                    # Firestore Timestamp object - use timestamp() method
                    start_ts = started_at.timestamp()
                    end_ts = end_time.timestamp()
                    duration_ms = int((end_ts - start_ts) * 1000)
                elif isinstance(started_at, datetime):
                    # Already a datetime object
                    if started_at.tzinfo is None:
                        # Assume UTC if no timezone
                        start_dt = started_at.replace(tzinfo=timezone.utc)
                    else:
                        start_dt = started_at
                    duration_ms = int((end_time - start_dt).total_seconds() * 1000)
                else:
                    # Try other conversion methods
                    if hasattr(started_at, 'toDate'):
                        start_dt = started_at.toDate()
                        if start_dt.tzinfo is None:
                            start_dt = start_dt.replace(tzinfo=timezone.utc)
                        duration_ms = int((end_time - start_dt).total_seconds() * 1000)
                    else:
                        # Fallback: try to parse as string or use existing duration
                        logger.warning(
                            "Could not parse started_at timestamp",
                            extra={"run_id": run_id, "started_at_type": str(type(started_at)), "request_id": request_id},
                        )
                        duration_ms = run_data.get("duration_ms", 0)
                
                # Ensure duration is not negative (sanity check)
                if duration_ms < 0:
                    logger.warning(
                        "Calculated negative duration, using existing or 0",
                        extra={"run_id": run_id, "calculated_duration_ms": duration_ms, "request_id": request_id},
                    )
                    duration_ms = run_data.get("duration_ms", 0)
                    
            except Exception as exc:
                logger.warning(
                    "Failed to calculate duration on cancel",
                    extra={"run_id": run_id, "error": str(exc), "started_at_type": str(type(started_at)), "request_id": request_id},
                    exc_info=True,
                )
                # Try to get existing duration_ms if calculation failed
                duration_ms = run_data.get("duration_ms", 0)
        
        # Preserve existing timing breakdown metrics if they exist
        update_data = {
            "status": "cancelled",  # Use lowercase to match integrity runner
            "ended_at": end_time,
            "duration_ms": duration_ms,
        }
        
        # Preserve timing breakdown if it exists
        if "duration_fetch" in run_data:
            update_data["duration_fetch"] = run_data["duration_fetch"]
        if "duration_checks" in run_data:
            update_data["duration_checks"] = run_data["duration_checks"]
        if "duration_write_airtable" in run_data:
            update_data["duration_write_airtable"] = run_data["duration_write_airtable"]
        if "duration_write_firestore" in run_data:
            update_data["duration_write_firestore"] = run_data["duration_write_firestore"]
        if "duration_write_issues_firestore" in run_data:
            update_data["duration_write_issues_firestore"] = run_data["duration_write_issues_firestore"]
        
        # Update run status to Canceled with duration
        firestore_client.record_run(run_id, update_data)
        
        # Log cancellation
        writer = FirestoreWriter(firestore_client)
        writer.write_log(run_id, "info", "Scan cancelled by user")
        
        logger.info("Run cancelled successfully", extra={"run_id": run_id, "request_id": request_id})
        return {"status": "success", "message": "Run cancellation requested", "run_id": run_id}
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Failed to cancel run",
            extra={"run_id": run_id, "error": str(exc), "request_id": request_id},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Failed to cancel run", "message": str(exc)},
        )


@app.delete("/integrity/run/{run_id}", dependencies=[Depends(verify_cloud_scheduler_auth)])
def delete_integrity_run(run_id: str, request: Request):
    """Delete an integrity run and all its associated logs.
    
    Args:
        run_id: Run identifier to delete
        request: FastAPI request object (injected)
    
    Returns:
        - 200: Success (run deleted)
        - 404: Run not found
    """
    request_id = getattr(request.state, "request_id", "unknown")
    logger.info("Integrity run deletion requested", extra={"run_id": run_id, "request_id": request_id})
    
    try:
        from .clients.firestore import FirestoreClient
        from .config.config_loader import load_runtime_config
        
        config = load_runtime_config()
        firestore_client = FirestoreClient(config.firestore)
        firestore_client.delete_run(run_id)
        
        logger.info("Integrity run deleted", extra={"run_id": run_id, "request_id": request_id})
        return {"status": "success", "message": "Run deleted successfully", "run_id": run_id}
    except Exception as exc:
        logger.error(
            "Failed to delete integrity run",
            extra={"run_id": run_id, "error": str(exc), "request_id": request_id},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Failed to delete run", "message": str(exc), "run_id": run_id},
        )


@app.get("/airtable/schema", dependencies=[Depends(verify_firebase_token)])
def airtable_schema():
    """Return the full Airtable schema snapshot JSON (requires authentication)."""
    try:
        return schema_service.load()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/airtable/schema/summary")
def airtable_schema_summary():
    """Return a compact rollup of Airtable tables, fields, and records (public endpoint)."""
    try:
        return schema_service.summary()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/airtable/schema/discover-table-ids", dependencies=[Depends(verify_firebase_token)])
def discover_and_update_table_ids():
    """Discover table IDs from schema JSON and update configuration.
    
    This endpoint:
    1. Loads the schema JSON and entity-to-table mapping
    2. Discovers table IDs by matching table names
    3. Updates .env file and/or Firestore config with discovered IDs
    
    Returns:
        Dictionary with discovered IDs and update status
    """
    try:
        # Discover table IDs and base ID
        discovery_result = discover_table_ids()
        
        if not discovery_result or not discovery_result.get("table_ids"):
            return {
                "success": False,
                "message": "No table IDs discovered. Check schema file and mapping config.",
                "discovered": {},
                "updates": {},
            }
        
        table_ids = discovery_result.get("table_ids", {})
        base_id = discovery_result.get("base_id")
        entities = list(table_ids.keys())
        
        # Get Firestore client for config updates (if available)
        firestore_client = None
        try:
            from .clients.firestore import FirestoreClient
            from .config.settings import FirestoreConfig
            from .config.config_loader import load_runtime_config
            
            # Try to get Firestore client from runtime config
            temp_config = load_runtime_config()
            firestore_client = FirestoreClient(temp_config.firestore)
        except Exception as exc:
            logger.debug(f"Firestore client not available for config updates: {exc}")
        
        # Update configuration
        update_results = update_config(
            table_ids,
            base_id=base_id,
            entities=entities,
            firestore_client=firestore_client,
            use_firestore=firestore_client is not None,
        )
        
        # Validate results
        validation = validate_discovered_ids(table_ids)
        all_valid = all(validation.values())
        
        # Count successful updates
        env_updates = sum(1 for v in update_results.get("env", {}).values() if v)
        firestore_updates = sum(1 for v in update_results.get("firestore", {}).values() if v)
        
        message = f"Discovered base ID and {len(table_ids)} table IDs. Updated {env_updates} in .env, {firestore_updates} in Firestore."
        if base_id:
            message = f"Discovered base ID ({base_id}) and {len(table_ids)} table IDs. Updated {env_updates} in .env, {firestore_updates} in Firestore."
        
        return {
            "success": True,
            "message": message,
            "discovered": {
                "base_id": base_id,
                "table_ids": table_ids,
            },
            "validation": validation,
            "updates": update_results,
            "all_valid": all_valid,
        }
        
    except FileNotFoundError as exc:
        logger.error(f"Schema or mapping file not found: {exc}")
        raise HTTPException(
            status_code=404,
            detail=f"Schema or mapping file not found: {exc}"
        ) from exc
    except Exception as exc:
        logger.error(f"Failed to discover table IDs: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to discover table IDs: {str(exc)}"
        ) from exc


@app.get("/airtable/records/{table_id}", dependencies=[Depends(verify_firebase_token)])
def airtable_records(table_id: str):
    """Fetch all records from a specific Airtable table for CSV export (requires authentication)."""
    try:
        schema_data = schema_service.load()
        base_id = schema_data.get("baseId")
        
        if not base_id:
            raise HTTPException(
                status_code=400,
                detail="Base ID not found in schema. Please regenerate the schema."
            )
        
        import os
        import time
        from pyairtable import Api
        from requests.exceptions import HTTPError, RequestException
        
        # Try PAT first (personal access token), fall back to API_KEY for backwards compatibility
        pat = os.getenv("AIRTABLE_PAT")
        api_key = os.getenv("AIRTABLE_API_KEY")
        
        if not pat and not api_key:
            raise HTTPException(
                status_code=500,
                detail="AIRTABLE_PAT or AIRTABLE_API_KEY environment variable must be set"
            )
        
        # Use PAT if available, otherwise use API_KEY
        token = pat or api_key
        api = Api(token)
        table = api.table(base_id, table_id)
        
        logger.info(
            "Fetching Airtable records for download",
            extra={"base": base_id, "table": table_id},
        )
        
        records = list(table.all())
        
        logger.info(
            "Fetched Airtable records successfully",
            extra={"base": base_id, "table": table_id, "record_count": len(records)},
        )
        
        return {"records": records, "count": len(records)}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (HTTPError, RequestException) as exc:
        logger.error(
            "Airtable API error",
            extra={"table_id": table_id, "error": str(exc)},
            exc_info=True,
        )
        raise HTTPException(
            status_code=502,
            detail=f"Airtable API error: {str(exc)}"
        ) from exc
    except Exception as exc:
        logger.error(
            "Failed to fetch Airtable records",
            extra={"table_id": table_id, "error": str(exc)},
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch records: {str(exc)}"
        ) from exc


@app.get("/integrity/metrics/summary")
def integrity_metrics_summary():
    """Return current issue counts by type and severity."""
    metrics_service = get_metrics_service()
    summary = metrics_service.get_issue_summary()
    latest_run = metrics_service.get_latest_run()
    
    response = {
        "summary": summary,
        "last_run": latest_run,
    }
    
    if latest_run:
        response["last_run_time"] = latest_run.get("started_at") or latest_run.get("ended_at")
        response["last_run_duration"] = latest_run.get("duration_ms")
    
    return response


@app.get("/integrity/metrics/runs")
def integrity_metrics_runs(limit: int = 10):
    """Return recent integrity run history."""
    metrics_service = get_metrics_service()
    runs = metrics_service.get_run_history(limit=limit)
    return {"runs": runs, "count": len(runs)}


@app.get("/integrity/metrics/trends")
def integrity_metrics_trends(days: int = 7):
    """Return daily metrics for trend charts."""
    metrics_service = get_metrics_service()
    trends = metrics_service.get_trend_data(days=days)
    return {"trends": trends, "days": days}


@app.get("/integrity/metrics/queues")
def integrity_metrics_queues():
    """Return issue queues grouped by category."""
    metrics_service = get_metrics_service()
    queues = metrics_service.get_issue_queues()
    return {"queues": queues, "count": len(queues)}


@app.get("/integrity/metrics/derived")
def integrity_metrics_derived():
    """Return derived metrics (completeness, link health, duplicate rate)."""
    metrics_service = get_metrics_service()
    derived = metrics_service.get_derived_metrics()
    return derived


@app.get("/integrity/metrics/flagged-rules")
def integrity_metrics_flagged_rules():
    """Return rules flagged for review due to high ignored percentage."""
    metrics_service = get_metrics_service()
    flagged_rules = metrics_service.get_flagged_rules()
    return {"flagged_rules": flagged_rules, "count": len(flagged_rules)}


@app.get("/integrity/metrics/kpi")
def integrity_metrics_kpi(weeks: int = 8):
    """Return KPI measurement data and trend.

    Args:
        weeks: Number of weeks of history to return (default 8)

    Returns:
        Dictionary with latest KPI, trend data, and alerts
    """
    from .services.kpi_sampler import get_kpi_sampler

    sampler = get_kpi_sampler()
    # Use public method instead of accessing private internals
    samples = sampler.get_recent_kpi_samples(limit=weeks)
    
    # Get latest sample
    latest = samples[0] if samples else None
    
    # Build trend
    trend = []
    for sample in reversed(samples):
        if "kpi_percent" in sample:
            trend.append({
                "week_id": sample.get("week_id", ""),
                "kpi_percent": sample.get("kpi_percent", 0),
                "measured_at": sample.get("measured_at"),
            })
    
    # Check for alerts
    alerts = []
    if latest:
        if latest.get("kpi_percent", 100) < 90:
            alerts.append({
                "type": "kpi_below_target",
                "message": f"KPI at {latest.get('kpi_percent', 0)}% (target: 90%)",
                "severity": "warning",
            })
        if latest.get("false_negatives", 0) > 10:
            alerts.append({
                "type": "high_false_negatives",
                "message": f"{latest.get('false_negatives', 0)} false negatives detected",
                "severity": "info",
            })
    
    return {
        "latest": latest,
        "trend": trend,
        "alerts": alerts,
        "target": 90.0,
    }


@app.post("/integrity/kpi/sample", dependencies=[Depends(verify_cloud_scheduler_auth)])
def integrity_kpi_sample():
    """Trigger weekly KPI sampling (called by scheduler or authenticated requests).

    This endpoint generates a sample but does not calculate KPI until reviewer labels are provided.
    """
    from ..services.kpi_sampler import get_kpi_sampler
    from ..services.integrity_runner import IntegrityRunner
    
    try:
        # Fetch current records for sampling
        runner = IntegrityRunner()
        records, _ = runner._fetch_records("full")
        
        # Generate sample
        sampler = get_kpi_sampler()
        sample_data = sampler.generate_weekly_sample(records)
        
        # Store sample
        sampler._firestore_client.record_kpi_sample(sample_data["week_id"], sample_data)
        
        return {
            "status": "success",
            "week_id": sample_data["week_id"],
            "sample_size": sample_data["sample_size"],
            "message": "KPI sample generated. Awaiting reviewer labels.",
        }
    except Exception as exc:
        logger.error(
            "KPI sampling failed",
            extra={"error": str(exc)},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "KPI sampling failed", "message": str(exc)},
        )
