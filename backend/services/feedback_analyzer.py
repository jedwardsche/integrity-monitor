"""Analyze ignored issues and flag rules for review."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from ..clients.firestore import FirestoreClient
from ..config.settings import FirestoreConfig, RuntimeConfig
from ..config.config_loader import load_runtime_config

logger = logging.getLogger(__name__)

IGNORED_THRESHOLD = 0.10  # 10% ignored issues triggers flag


class FeedbackAnalyzer:
    """Analyzes ignored issues and flags rules exceeding threshold."""

    def __init__(self, runtime_config: Optional[RuntimeConfig] = None):
        self._config = runtime_config or load_runtime_config()
        self._firestore_client = FirestoreClient(self._config.firestore)

    def analyze_ignored_issues(self) -> List[Dict]:
        """Analyze ignored issues and return flagged rules.
        
        Returns:
            List of dictionaries with rule_id, ignored_count, total_count, ignored_percentage
        """
        try:
            client = self._firestore_client._get_client()
            collection_ref = client.collection(self._config.firestore.issues_collection)
            
            # Query all issues
            all_issues = list(collection_ref.stream())
            
            # Group by rule_id
            rule_stats: Dict[str, Dict[str, int]] = defaultdict(lambda: {"total": 0, "ignored": 0})
            
            for doc in all_issues:
                data = doc.to_dict()
                rule_id = data.get("rule_id", "unknown")
                status = data.get("status", "open")
                
                rule_stats[rule_id]["total"] += 1
                if status == "ignored":
                    rule_stats[rule_id]["ignored"] += 1
            
            # Calculate percentages and flag rules
            flagged_rules: List[Dict] = []
            for rule_id, stats in rule_stats.items():
                if stats["total"] == 0:
                    continue
                
                ignored_percentage = stats["ignored"] / stats["total"]
                
                if ignored_percentage > IGNORED_THRESHOLD:
                    flagged_rules.append({
                        "rule_id": rule_id,
                        "ignored_count": stats["ignored"],
                        "total_count": stats["total"],
                        "ignored_percentage": round(ignored_percentage * 100, 2),
                        "flagged_at": datetime.now(timezone.utc),
                    })
            
            # Sort by ignored percentage descending
            flagged_rules.sort(key=lambda x: x["ignored_percentage"], reverse=True)
            
            logger.info(
                "Analyzed ignored issues",
                extra={"total_rules": len(rule_stats), "flagged_rules": len(flagged_rules)},
            )
            
            return flagged_rules
            
        except Exception as exc:
            logger.error(
                "Failed to analyze ignored issues",
                extra={"error": str(exc)},
                exc_info=True,
            )
            return []

    def get_flagged_rules(self) -> List[Dict]:
        """Get currently flagged rules from Firestore.
        
        Returns:
            List of flagged rule documents
        """
        try:
            client = self._firestore_client._get_client()
            collection_ref = client.collection("integrity_flagged_rules")
            
            # Query flagged rules, sorted by ignored_percentage descending
            query = collection_ref.order_by("ignored_percentage", direction="DESCENDING").limit(10)
            docs = list(query.stream())
            
            flagged_rules = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                flagged_rules.append(data)
            
            return flagged_rules
            
        except Exception as exc:
            logger.error(
                "Failed to get flagged rules",
                extra={"error": str(exc)},
                exc_info=True,
            )
            return []

    def record_flagged_rules(self, flagged_rules: List[Dict]) -> None:
        """Record flagged rules to Firestore.
        
        Args:
            flagged_rules: List of flagged rule dictionaries
        """
        if not flagged_rules:
            return
        
        try:
            client = self._firestore_client._get_client()
            collection_ref = client.collection("integrity_flagged_rules")
            
            batch = client.batch()
            batch_count = 0
            
            for rule in flagged_rules:
                # Use rule_id as document ID
                doc_ref = collection_ref.document(rule["rule_id"])
                
                rule_data = rule.copy()
                if "flagged_at" not in rule_data:
                    rule_data["flagged_at"] = datetime.now(timezone.utc)
                rule_data["updated_at"] = datetime.now(timezone.utc)
                
                batch.set(doc_ref, rule_data, merge=True)
                batch_count += 1
                
                if batch_count >= 500:
                    batch.commit()
                    batch = client.batch()
                    batch_count = 0
            
            if batch_count > 0:
                batch.commit()
            
            logger.info(
                "Recorded flagged rules",
                extra={"count": len(flagged_rules)},
            )
            
        except Exception as exc:
            logger.error(
                "Failed to record flagged rules",
                extra={"error": str(exc), "count": len(flagged_rules)},
                exc_info=True,
            )
            raise


def get_feedback_analyzer(runtime_config: Optional[RuntimeConfig] = None) -> FeedbackAnalyzer:
    """Get or create a FeedbackAnalyzer instance."""
    return FeedbackAnalyzer(runtime_config)
