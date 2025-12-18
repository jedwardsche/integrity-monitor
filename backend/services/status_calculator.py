"""Calculate run result status based on issue counts and severity."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class StatusThresholds:
    """Configuration for status calculation thresholds."""
    
    def __init__(
        self,
        healthy_max: int = 50,
        warning_max: int = 200,
        critical_min: int = 201,
        weights: Optional[Dict[str, int]] = None,
    ):
        self.healthy_max = healthy_max
        self.warning_max = warning_max
        self.critical_min = critical_min
        self.weights = weights or {
            "critical": 10,
            "warning": 3,
            "info": 1,
        }


def calculate_result_status(
    counts: Dict[str, Any],
    thresholds: Optional[StatusThresholds] = None,
) -> str:
    """Calculate run result status based on issue counts.
    
    Args:
        counts: Dictionary with issue counts. Expected structure:
            - counts["by_severity"]: Dict with keys "critical", "warning", "info"
            - Or counts can be the summary dict from scorer.summarize()
        thresholds: Optional StatusThresholds instance. If None, uses defaults.
    
    Returns:
        "healthy", "warning", or "critical"
    """
    if thresholds is None:
        thresholds = StatusThresholds()
    
    # Extract severity counts
    by_severity = counts.get("by_severity", {})
    
    # If counts is a flat summary dict (from scorer.summarize), extract severity counts
    if not by_severity and isinstance(counts, dict):
        critical = 0
        warning = 0
        info = 0
        
        for key, value in counts.items():
            if isinstance(value, int) and ":" in key:
                # Key format: "issue_type:severity"
                parts = key.split(":", 1)
                if len(parts) == 2:
                    severity = parts[1].lower()
                    if severity == "critical":
                        critical += value
                    elif severity == "warning":
                        warning += value
                    elif severity == "info":
                        info += value
        
        by_severity = {
            "critical": critical,
            "warning": warning,
            "info": info,
        }
    
    # Get counts by severity (default to 0 if not present)
    critical_count = by_severity.get("critical", 0) or 0
    warning_count = by_severity.get("warning", 0) or 0
    info_count = by_severity.get("info", 0) or 0
    
    # Priority-based status: critical > warning > healthy
    # If there are ANY critical issues, status is critical
    # If there are ANY warnings (and no critical), status is warning
    # Otherwise, status is healthy
    
    logger.debug(
        "Status calculation",
        extra={
            "critical": critical_count,
            "warning": warning_count,
            "info": info_count,
            "by_severity": by_severity,
        },
    )
    
    # Priority-based status determination
    if critical_count > 0:
        return "critical"
    elif warning_count > 0:
        return "warning"
    else:
        return "healthy"
