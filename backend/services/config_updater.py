"""Service to update configuration with discovered table IDs."""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Dict, Optional

from dotenv import dotenv_values, set_key

logger = logging.getLogger(__name__)

DEFAULT_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def get_env_var_name(entity: str, is_base: bool = False) -> str:
    """Get environment variable name for an entity.
    
    Args:
        entity: Entity name (e.g., "students")
        is_base: If True, return base env var, else table env var
        
    Returns:
        Environment variable name (e.g., "AT_STUDENTS_TABLE")
    """
    prefix = "AT_"
    suffix = "_BASE" if is_base else "_TABLE"
    entity_upper = entity.upper()
    return f"{prefix}{entity_upper}{suffix}"


def update_env_file(
    table_ids: Dict[str, str],
    env_path: Optional[Path] = None,
) -> Dict[str, bool]:
    """Update .env file with discovered table IDs.
    
    Args:
        table_ids: Dictionary mapping entity names to table IDs
        env_path: Optional path to .env file (defaults to DEFAULT_ENV_PATH)
        
    Returns:
        Dictionary mapping entity names to update success status
    """
    env_file = env_path or DEFAULT_ENV_PATH
    
    if not env_file.exists():
        logger.warning(f".env file not found at {env_file}, creating it")
        env_file.parent.mkdir(parents=True, exist_ok=True)
        env_file.touch()
    
    # Read existing .env file
    existing = dotenv_values(env_file)
    
    # Update table ID variables
    results: Dict[str, bool] = {}
    updated_count = 0
    
    for entity, table_id in table_ids.items():
        var_name = get_env_var_name(entity, is_base=False)
        old_value = existing.get(var_name)
        
        if old_value != table_id:
            try:
                # Use set_key to update .env file
                set_key(env_file, var_name, table_id)
                results[entity] = True
                updated_count += 1
                if old_value:
                    logger.info(f"Updated {var_name}: {old_value} -> {table_id}")
                else:
                    logger.info(f"Set {var_name}: {table_id}")
            except Exception as exc:
                logger.error(f"Failed to update {var_name}: {exc}")
                results[entity] = False
        else:
            results[entity] = True  # Already correct
            logger.debug(f"{var_name} already set correctly")
    
    logger.info(f"Updated {updated_count} table ID variables in .env file")
    return results


def update_firestore_config(
    table_ids: Dict[str, str],
    firestore_client: Optional[Any] = None,
) -> Dict[str, bool]:
    """Update Firestore config document with discovered table IDs.
    
    Args:
        table_ids: Dictionary mapping entity names to table IDs
        firestore_client: Optional FirestoreClient instance
        
    Returns:
        Dictionary mapping entity names to update success status
    """
    if firestore_client is None:
        logger.warning("Firestore client not available, skipping Firestore config update")
        return {entity: False for entity in table_ids.keys()}
    
    try:
        client = firestore_client._get_client()
        config_doc_path = firestore_client._config.config_document
        
        # Parse document path (e.g., "integrity_config/current")
        parts = config_doc_path.split("/")
        if len(parts) != 2:
            logger.error(f"Invalid config document path: {config_doc_path}")
            return {entity: False for entity in table_ids.keys()}
        
        collection_name, doc_id = parts
        doc_ref = client.collection(collection_name).document(doc_id)
        
        # Get existing document or create new one
        doc = doc_ref.get()
        existing_data = doc.to_dict() if doc.exists else {}
        
        # Build update structure
        if "airtable" not in existing_data:
            existing_data["airtable"] = {}
        
        # Update table IDs in nested structure matching rules.yaml format
        results: Dict[str, bool] = {}
        updated_count = 0
        
        for entity, table_id in table_ids.items():
            if entity not in existing_data["airtable"]:
                existing_data["airtable"][entity] = {}
            
            old_table_id = existing_data["airtable"][entity].get("table_id")
            if old_table_id != table_id:
                existing_data["airtable"][entity]["table_id"] = table_id
                results[entity] = True
                updated_count += 1
                if old_table_id:
                    logger.info(f"Updated Firestore config: {entity}.table_id: {old_table_id} -> {table_id}")
                else:
                    logger.info(f"Set Firestore config: {entity}.table_id: {table_id}")
            else:
                results[entity] = True
                logger.debug(f"Firestore config already correct for {entity}")
        
        # Write updated document
        if updated_count > 0:
            doc_ref.set(existing_data, merge=True)
            logger.info(f"Updated Firestore config document with {updated_count} table IDs")
        
        return results
        
    except Exception as exc:
        logger.error(f"Failed to update Firestore config: {exc}", exc_info=True)
        return {entity: False for entity in table_ids.keys()}


def update_config(
    table_ids: Dict[str, str],
    env_path: Optional[Path] = None,
    firestore_client: Optional[Any] = None,
    use_firestore: bool = True,
) -> Dict[str, Dict[str, bool]]:
    """Update configuration with discovered table IDs.
    
    Updates both .env file (for local dev) and Firestore config (for production).
    
    Args:
        table_ids: Dictionary mapping entity names to table IDs
        env_path: Optional path to .env file
        firestore_client: Optional FirestoreClient instance
        use_firestore: Whether to update Firestore config (default: True)
        
    Returns:
        Dictionary with "env" and "firestore" keys, each containing update results
    """
    results = {
        "env": {},
        "firestore": {},
    }
    
    # Always update .env file for local development
    try:
        results["env"] = update_env_file(table_ids, env_path)
    except Exception as exc:
        logger.error(f"Failed to update .env file: {exc}", exc_info=True)
        results["env"] = {entity: False for entity in table_ids.keys()}
    
    # Update Firestore config if available
    if use_firestore:
        try:
            results["firestore"] = update_firestore_config(table_ids, firestore_client)
        except Exception as exc:
            logger.error(f"Failed to update Firestore config: {exc}", exc_info=True)
            results["firestore"] = {entity: False for entity in table_ids.keys()}
    
    return results
