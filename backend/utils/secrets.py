"""Utility for securely fetching secrets from Google Secret Manager.

This module provides a secure way to fetch secrets for local development.
In production (Cloud Run), secrets are injected as environment variables.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def get_secret(secret_name: str, default: Optional[str] = None) -> Optional[str]:
    """Get a secret value from environment or Secret Manager.
    
    Priority:
    1. Environment variable (for Cloud Run where secrets are injected)
    2. Google Secret Manager (for local development)
    3. Default value (if provided)
    
    Args:
        secret_name: Name of the secret (e.g., "OPENAI_API_KEY")
        default: Optional default value if secret cannot be retrieved
    
    Returns:
        Secret value or None if not found
    """
    # First check environment variable (production/Cloud Run)
    value = os.getenv(secret_name)
    if value:
        return value
    
    # For local development, try Secret Manager
    # Only attempt if we're not in Cloud Run (detected by presence of K_SERVICE)
    if not os.getenv("K_SERVICE"):
        try:
            value = _fetch_from_secret_manager(secret_name)
            if value:
                return value
        except Exception as exc:
            logger.debug(f"Failed to fetch {secret_name} from Secret Manager: {exc}")
    
    return default


def _fetch_from_secret_manager(secret_name: str) -> Optional[str]:
    """Fetch secret from Google Secret Manager.
    
    Args:
        secret_name: Name of the secret in Secret Manager
    
    Returns:
        Secret value or None if not found
    """
    try:
        from google.cloud import secretmanager
        
        project_id = (
            os.getenv("GOOGLE_CLOUD_PROJECT")
            or os.getenv("GCP_PROJECT_ID")
            or "data-integrity-monitor"
        )
        
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
        
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")
    except ImportError:
        logger.debug("google-cloud-secret-manager not installed")
        return None
    except Exception as exc:
        logger.debug(f"Error fetching secret {secret_name}: {exc}")
        return None
