"""Service for managing rules: loading, validating, and saving to Firestore."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ..config.config_loader import load_runtime_config
from ..config.models import (
    DuplicateDefinition,
    DuplicateRule,
    FieldRequirement,
    RelationshipRule,
    SchemaConfig,
)
from ..config.schema_loader import load_schema_config
from ..config.settings import AttendanceRules
from ..clients.firestore import FirestoreClient

logger = logging.getLogger(__name__)


class RulesService:
    """Service for managing integrity rules with Firestore persistence."""

    def __init__(self, firestore_client: Optional[FirestoreClient] = None):
        """Initialize rules service.
        
        Args:
            firestore_client: Optional FirestoreClient. If None, will try to create one.
        """
        self._firestore_client = firestore_client
        if firestore_client is None:
            try:
                runtime_config = load_runtime_config()
                self._firestore_client = FirestoreClient(runtime_config.firestore)
            except Exception as exc:
                logger.warning(f"Could not initialize Firestore client: {exc}")
                self._firestore_client = None

    def _get_firestore_config(self) -> Dict[str, Any]:
        """Load current rules from Firestore config document."""
        if self._firestore_client is None:
            return {}
        
        try:
            client = self._firestore_client._get_client()
            config_doc_path = self._firestore_client._config.config_document
            parts = config_doc_path.split("/")
            if len(parts) != 2:
                return {}
            
            collection_name, doc_id = parts
            doc_ref = client.collection(collection_name).document(doc_id)
            doc = doc_ref.get()
            
            if doc.exists:
                data = doc.to_dict() or {}
                # Extract rule-related sections
                result = {}
                for key in ["duplicates", "relationships", "required_fields", "attendance_rules"]:
                    if key in data:
                        result[key] = data[key]
                return result
        except Exception as exc:
            logger.error(f"Failed to load Firestore config: {exc}", exc_info=True)
        
        return {}

    def _save_firestore_config(self, updates: Dict[str, Any], user_id: Optional[str] = None) -> None:
        """Save rule updates to Firestore config document.
        
        Args:
            updates: Dictionary of rule updates to merge
            user_id: Optional user ID for audit trail
        """
        if self._firestore_client is None:
            raise ValueError("Firestore client not available")
        
        try:
            client = self._firestore_client._get_client()
            config_doc_path = self._firestore_client._config.config_document
            parts = config_doc_path.split("/")
            if len(parts) != 2:
                raise ValueError(f"Invalid config document path: {config_doc_path}")
            
            collection_name, doc_id = parts
            doc_ref = client.collection(collection_name).document(doc_id)
            
            # Get current document
            doc = doc_ref.get()
            current_data = doc.to_dict() if doc.exists else {}
            
            # Deep merge updates
            merged = self._deep_merge(current_data, updates)
            
            # Update metadata
            if "metadata" not in merged:
                merged["metadata"] = {}
            merged["metadata"]["last_updated"] = datetime.now(timezone.utc).isoformat()
            if user_id:
                merged["metadata"]["updated_by"] = user_id
            
            # Save to Firestore
            doc_ref.set(merged, merge=False)
            logger.info(f"Saved rule updates to Firestore: {list(updates.keys())}")
        except Exception as exc:
            logger.error(f"Failed to save Firestore config: {exc}", exc_info=True)
            raise

    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """Deep merge override dict into base dict."""
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    def get_all_rules(self) -> Dict[str, Any]:
        """Get all rules merged from YAML and Firestore.
        
        Returns:
            Dictionary with rule categories and their rules, including source metadata.
        """
        # Load base rules from YAML (without Firestore client to avoid blocking)
        # We'll merge Firestore rules separately
        try:
            schema_config = load_schema_config(firestore_client=None)
        except Exception as exc:
            logger.warning(f"Failed to load schema config: {exc}")
            from ..config.models import SchemaConfig, SchemaMetadata
            schema_config = SchemaConfig(
                metadata=SchemaMetadata(source="", generated=""),
                entities={},
                duplicates={},
            )
        
        try:
            # Load runtime config without discovery to avoid hanging
            runtime_config = load_runtime_config(
                firestore_client=None,
                attempt_discovery=False,
            )
        except Exception as exc:
            logger.warning(f"Failed to load runtime config: {exc}")
            # Return early with empty structure if we can't load config
            return {
                "duplicates": {},
                "relationships": {},
                "required_fields": {},
                "attendance_rules": {
                    "onboarding_grace_days": 7,
                    "limited_schedule_threshold": 3,
                    "thresholds": {},
                },
            }
        
        firestore_rules = self._get_firestore_config()
        
        # Safely get attendance rules
        try:
            attendance_rules_data = runtime_config.attendance_rules.model_dump()
        except Exception:
            attendance_rules_data = {
                "onboarding_grace_days": 7,
                "limited_schedule_threshold": 3,
                "thresholds": {},
            }
        
        result = {
            "duplicates": {},
            "relationships": {},
            "required_fields": {},
            "attendance_rules": attendance_rules_data,
        }
        
        # Add duplicates from schema config
        for entity, dup_def in schema_config.duplicates.items():
            result["duplicates"][entity] = {
                "likely": [rule.model_dump() for rule in dup_def.likely],
                "possible": [rule.model_dump() for rule in dup_def.possible],
                "source": "yaml",
            }
        
        # Add relationships from schema config
        for entity_name, entity_schema in schema_config.entities.items():
            if entity_schema.relationships:
                result["relationships"][entity_name] = {}
                for rel_key, rel_rule in entity_schema.relationships.items():
                    result["relationships"][entity_name][rel_key] = {
                        **rel_rule.model_dump(),
                        "source": "yaml",
                    }
        
        # Add required fields from schema config
        for entity_name, entity_schema in schema_config.entities.items():
            if entity_schema.missing_key_data:
                result["required_fields"][entity_name] = [
                    {**req.model_dump(), "source": "yaml"}
                    for req in entity_schema.missing_key_data
                ]
        
        # Merge Firestore overrides
        if firestore_rules.get("duplicates"):
            for entity, dup_def in firestore_rules["duplicates"].items():
                if entity not in result["duplicates"]:
                    result["duplicates"][entity] = {"likely": [], "possible": [], "source": "firestore"}
                if "likely" in dup_def:
                    result["duplicates"][entity]["likely"] = [
                        {**rule, "source": "firestore"} for rule in dup_def["likely"]
                    ]
                if "possible" in dup_def:
                    result["duplicates"][entity]["possible"] = [
                        {**rule, "source": "firestore"} for rule in dup_def["possible"]
                    ]
                result["duplicates"][entity]["source"] = "firestore"
        
        if firestore_rules.get("relationships"):
            for entity, rels in firestore_rules["relationships"].items():
                if entity not in result["relationships"]:
                    result["relationships"][entity] = {}
                for rel_key, rel_rule in rels.items():
                    result["relationships"][entity][rel_key] = {
                        **rel_rule,
                        "source": "firestore",
                    }
        
        if firestore_rules.get("required_fields"):
            for entity, fields in firestore_rules["required_fields"].items():
                if entity not in result["required_fields"]:
                    result["required_fields"][entity] = []
                result["required_fields"][entity] = [
                    {**field, "source": "firestore"} for field in fields
                ]
        
        if firestore_rules.get("attendance_rules"):
            result["attendance_rules"] = {
                **result["attendance_rules"],
                **firestore_rules["attendance_rules"],
                "source": "firestore",
            }
        
        return result

    def get_rules_by_category(self, category: str) -> Dict[str, Any]:
        """Get rules for a specific category.
        
        Args:
            category: One of 'duplicates', 'relationships', 'required_fields', 'attendance_rules'
        
        Returns:
            Dictionary of rules for that category
        """
        all_rules = self.get_all_rules()
        return all_rules.get(category, {})

    def create_rule(
        self,
        category: str,
        entity: Optional[str],
        rule_data: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new rule and save to Firestore.
        
        Args:
            category: Rule category ('duplicates', 'relationships', 'required_fields', 'attendance_rules')
            entity: Entity name (required for duplicates, relationships, required_fields)
            rule_data: Rule data dictionary
            user_id: Optional user ID for audit trail
        
        Returns:
            Created rule with generated ID
        """
        # Validate rule structure
        self._validate_rule(category, entity, rule_data)
        
        # Get current Firestore rules
        firestore_rules = self._get_firestore_config()
        
        # Initialize category if needed
        if category not in firestore_rules:
            firestore_rules[category] = {}
        
        # Generate rule ID if not provided
        if "rule_id" not in rule_data and category != "attendance_rules":
            rule_data["rule_id"] = self._generate_rule_id(category, entity, rule_data)
        
        # Add rule to appropriate structure
        if category == "duplicates":
            if entity not in firestore_rules[category]:
                firestore_rules[category][entity] = {"likely": [], "possible": []}
            confidence = rule_data.pop("confidence", "likely")
            firestore_rules[category][entity][confidence].append(rule_data)
        elif category == "relationships":
            if entity not in firestore_rules[category]:
                firestore_rules[category][entity] = {}
            rel_key = rule_data.get("relationship_key") or rule_data.get("rule_id", "").split(".")[-1]
            firestore_rules[category][entity][rel_key] = rule_data
        elif category == "required_fields":
            if entity not in firestore_rules[category]:
                firestore_rules[category][entity] = []
            firestore_rules[category][entity].append(rule_data)
        elif category == "attendance_rules":
            # Merge into existing attendance rules
            if "thresholds" in rule_data:
                if "thresholds" not in firestore_rules[category]:
                    firestore_rules[category]["thresholds"] = {}
                firestore_rules[category]["thresholds"].update(rule_data["thresholds"])
            else:
                firestore_rules[category].update(rule_data)
        
        # Save to Firestore
        self._save_firestore_config(firestore_rules, user_id)
        
        return rule_data

    def update_rule(
        self,
        category: str,
        entity: Optional[str],
        rule_id: str,
        rule_data: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update an existing rule in Firestore.
        
        Args:
            category: Rule category
            entity: Entity name (required for duplicates, relationships, required_fields)
            rule_id: Rule ID to update
            rule_data: Updated rule data
            user_id: Optional user ID for audit trail
        
        Returns:
            Updated rule
        """
        firestore_rules = self._get_firestore_config()
        
        if category not in firestore_rules:
            raise ValueError(f"Category {category} not found in Firestore rules")
        
        if category == "duplicates":
            if entity not in firestore_rules[category]:
                raise ValueError(f"Entity {entity} not found in duplicates")
            # Find and update rule in likely or possible
            for confidence in ["likely", "possible"]:
                for i, rule in enumerate(firestore_rules[category][entity].get(confidence, [])):
                    if rule.get("rule_id") == rule_id:
                        firestore_rules[category][entity][confidence][i] = {
                            **rule,
                            **rule_data,
                            "rule_id": rule_id,
                        }
                        self._save_firestore_config(firestore_rules, user_id)
                        return firestore_rules[category][entity][confidence][i]
            raise ValueError(f"Rule {rule_id} not found")
        elif category == "relationships":
            if entity not in firestore_rules[category]:
                raise ValueError(f"Entity {entity} not found in relationships")
            # Find by relationship key or rule_id
            for rel_key, rel_rule in firestore_rules[category][entity].items():
                if rel_key == rule_id or rel_rule.get("rule_id") == rule_id:
                    firestore_rules[category][entity][rel_key] = {
                        **rel_rule,
                        **rule_data,
                    }
                    self._save_firestore_config(firestore_rules, user_id)
                    return firestore_rules[category][entity][rel_key]
            raise ValueError(f"Rule {rule_id} not found")
        elif category == "required_fields":
            if entity not in firestore_rules[category]:
                raise ValueError(f"Entity {entity} not found in required_fields")
            for i, field_rule in enumerate(firestore_rules[category][entity]):
                if field_rule.get("rule_id") == rule_id or field_rule.get("field") == rule_id:
                    firestore_rules[category][entity][i] = {
                        **field_rule,
                        **rule_data,
                    }
                    self._save_firestore_config(firestore_rules, user_id)
                    return firestore_rules[category][entity][i]
            raise ValueError(f"Rule {rule_id} not found")
        elif category == "attendance_rules":
            # Update attendance rules (merge)
            firestore_rules[category] = {
                **firestore_rules.get(category, {}),
                **rule_data,
            }
            self._save_firestore_config(firestore_rules, user_id)
            return firestore_rules[category]
        
        raise ValueError(f"Unknown category: {category}")

    def delete_rule(
        self,
        category: str,
        entity: Optional[str],
        rule_id: str,
        user_id: Optional[str] = None,
    ) -> None:
        """Delete a rule from Firestore.
        
        Args:
            category: Rule category
            entity: Entity name (required for duplicates, relationships, required_fields)
            rule_id: Rule ID to delete
            user_id: Optional user ID for audit trail
        """
        firestore_rules = self._get_firestore_config()
        
        if category not in firestore_rules:
            raise ValueError(f"Category {category} not found")
        
        if category == "duplicates":
            if entity not in firestore_rules[category]:
                raise ValueError(f"Entity {entity} not found")
            # Find and remove from likely or possible
            for confidence in ["likely", "possible"]:
                rules = firestore_rules[category][entity].get(confidence, [])
                firestore_rules[category][entity][confidence] = [
                    r for r in rules if r.get("rule_id") != rule_id
                ]
        elif category == "relationships":
            if entity not in firestore_rules[category]:
                raise ValueError(f"Entity {entity} not found")
            # Remove by relationship key or rule_id
            keys_to_remove = []
            for rel_key, rel_rule in firestore_rules[category][entity].items():
                if rel_key == rule_id or rel_rule.get("rule_id") == rule_id:
                    keys_to_remove.append(rel_key)
            for key in keys_to_remove:
                del firestore_rules[category][entity][key]
            if not keys_to_remove:
                raise ValueError(f"Rule {rule_id} not found")
        elif category == "required_fields":
            if entity not in firestore_rules[category]:
                raise ValueError(f"Entity {entity} not found")
            original_len = len(firestore_rules[category][entity])
            firestore_rules[category][entity] = [
                r for r in firestore_rules[category][entity]
                if r.get("rule_id") != rule_id and r.get("field") != rule_id
            ]
            if len(firestore_rules[category][entity]) == original_len:
                raise ValueError(f"Rule {rule_id} not found")
        elif category == "attendance_rules":
            # For attendance rules, we can delete specific thresholds
            if "thresholds" in rule_id and "thresholds" in firestore_rules[category]:
                threshold_name = rule_id.replace("thresholds.", "")
                if threshold_name in firestore_rules[category]["thresholds"]:
                    del firestore_rules[category]["thresholds"][threshold_name]
                else:
                    raise ValueError(f"Threshold {threshold_name} not found")
            else:
                raise ValueError(f"Cannot delete attendance rule: {rule_id}")
        
        self._save_firestore_config(firestore_rules, user_id)

    def _validate_rule(self, category: str, entity: Optional[str], rule_data: Dict[str, Any]) -> None:
        """Validate rule structure against Pydantic models."""
        try:
            if category == "duplicates":
                DuplicateRule.model_validate(rule_data)
            elif category == "relationships":
                RelationshipRule.model_validate(rule_data)
            elif category == "required_fields":
                FieldRequirement.model_validate(rule_data)
            elif category == "attendance_rules":
                # Validate attendance rules structure
                if "thresholds" in rule_data:
                    for threshold_name, threshold_data in rule_data["thresholds"].items():
                        if not isinstance(threshold_data, dict):
                            raise ValueError(f"Threshold {threshold_name} must be a dictionary")
            else:
                raise ValueError(f"Unknown category: {category}")
        except Exception as exc:
            raise ValueError(f"Invalid rule structure: {exc}") from exc

    def _generate_rule_id(self, category: str, entity: Optional[str], rule_data: Dict[str, Any]) -> str:
        """Generate a unique rule ID."""
        if category == "duplicates":
            # Use description or fields to generate ID
            desc = rule_data.get("description", "").lower().replace(" ", "_")
            return f"dup.{entity}.{desc[:30]}"
        elif category == "relationships":
            target = rule_data.get("target", "unknown")
            return f"link.{entity}.{target}"
        elif category == "required_fields":
            field = rule_data.get("field", "unknown")
            return f"required.{entity}.{field}"
        return f"{category}.{entity}.{hash(str(rule_data)) % 10000}"
