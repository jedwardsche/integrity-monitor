import logging
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

# Load environment variables from backend/.env
from dotenv import load_dotenv
backend_dir = Path(__file__).parent
load_dotenv(backend_dir / ".env")

from .config.schema_loader import load_schema_config
from .middleware.auth import verify_bearer_token, verify_cloud_scheduler_auth, verify_firebase_token
from .services.integrity_runner import IntegrityRunner
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
    allow_methods=["GET", "POST"],
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

schema_config = load_schema_config()
runner = IntegrityRunner()


@app.get("/health")
def health():
    return {"status": "ok"}


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
    return schema_config.model_dump()


@app.post("/integrity/run", dependencies=[Depends(verify_cloud_scheduler_auth)])
def run_integrity(request: Request, mode: str = "incremental", trigger: str = "manual"):
    """Trigger the integrity runner.

    Args:
        request: FastAPI request object (injected)
        mode: Run mode ("incremental" or "full")
        trigger: Trigger source ("nightly", "weekly", or "manual")

    Returns:
        - 200: Success (check response body for status: "success", "warning", or "error")
        - 500: Complete system failure (unable to execute run)
    """
    # Get request ID from middleware
    request_id = getattr(request.state, "request_id", "unknown")
    logger.info("Integrity run requested", extra={"mode": mode, "trigger": trigger, "request_id": request_id})

    try:
        result = runner.run(mode=mode, trigger=trigger)
        run_status = result.get("status", "success")

        # Return 200 OK for all successful runs (status details in response body)
        # Only return 500 if the run itself failed to execute
        http_status = status.HTTP_200_OK
        
        logger.info(
            "Integrity run completed",
            extra={
                "run_id": result.get("run_id"),
                "status": run_status,
                "request_id": request_id,
            },
        )
        
        return result
        
    except IntegrityRunError as exc:
        logger.error(
            "Integrity run failed",
            extra={"run_id": exc.run_id, "error": str(exc), "request_id": request_id},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": str(exc),
                "run_id": exc.run_id,
                "transient": exc.transient,
            },
        )
    except Exception as exc:
        logger.error(
            "Unexpected error in integrity run",
            extra={"error": str(exc), "request_id": request_id},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Unexpected error occurred", "message": str(exc)},
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
        # Discover table IDs
        discovered_ids = discover_table_ids()
        
        if not discovered_ids:
            return {
                "success": False,
                "message": "No table IDs discovered. Check schema file and mapping config.",
                "discovered": {},
                "updates": {},
            }
        
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
            discovered_ids,
            firestore_client=firestore_client,
            use_firestore=firestore_client is not None,
        )
        
        # Validate results
        validation = validate_discovered_ids(discovered_ids)
        all_valid = all(validation.values())
        
        # Count successful updates
        env_updates = sum(1 for v in update_results.get("env", {}).values() if v)
        firestore_updates = sum(1 for v in update_results.get("firestore", {}).values() if v)
        
        return {
            "success": True,
            "message": f"Discovered {len(discovered_ids)} table IDs. Updated {env_updates} in .env, {firestore_updates} in Firestore.",
            "discovered": discovered_ids,
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
