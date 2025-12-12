"""Structured logging utilities."""

import json
import logging
from typing import Any, Dict, Optional


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add extra fields from record
        if hasattr(record, "run_id"):
            log_data["run_id"] = record.run_id
        if hasattr(record, "stage"):
            log_data["stage"] = record.stage
        if hasattr(record, "duration_ms"):
            log_data["duration_ms"] = record.duration_ms
        if hasattr(record, "entity_counts"):
            log_data["entity_counts"] = record.entity_counts
        if hasattr(record, "severity_breakdown"):
            log_data["severity_breakdown"] = record.severity_breakdown
        
        # Add any other extra fields
        for key, value in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "created", "filename", "funcName",
                "levelname", "levelno", "lineno", "module", "msecs",
                "message", "pathname", "process", "processName", "relativeCreated",
                "thread", "threadName", "exc_info", "exc_text", "stack_info",
            }:
                if not key.startswith("_"):
                    log_data[key] = value
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_data)


def get_logger(name: str) -> logging.Logger:
    """Get a logger with JSON formatting configured."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def log_config_load(
    logger: logging.Logger,
    run_id: str,
    duration_ms: int,
    config_version: Optional[str] = None,
) -> None:
    """Log config load stage."""
    extra: Dict[str, Any] = {
        "run_id": run_id,
        "stage": "config_load",
        "duration_ms": duration_ms,
    }
    if config_version:
        extra["config_version"] = config_version
    logger.info("Config loaded", extra=extra)


def log_fetch(
    logger: logging.Logger,
    run_id: str,
    entity_counts: Dict[str, int],
    duration_ms: int,
) -> None:
    """Log fetch stage."""
    logger.info(
        "Records fetched",
        extra={
            "run_id": run_id,
            "stage": "fetch",
            "entity_counts": entity_counts,
            "duration_ms": duration_ms,
        },
    )


def log_check(
    logger: logging.Logger,
    run_id: str,
    check_name: str,
    issue_count: int,
    duration_ms: int,
    severity_breakdown: Optional[Dict[str, int]] = None,
) -> None:
    """Log check execution stage."""
    extra: Dict[str, Any] = {
        "run_id": run_id,
        "stage": check_name,
        "issue_count": issue_count,
        "duration_ms": duration_ms,
    }
    if severity_breakdown:
        extra["severity_breakdown"] = severity_breakdown
    logger.info(f"Check {check_name} completed", extra=extra)


def log_write(
    logger: logging.Logger,
    run_id: str,
    target: str,
    count: int,
    duration_ms: int,
) -> None:
    """Log write stage."""
    logger.info(
        f"Write to {target} completed",
        extra={
            "run_id": run_id,
            "stage": f"write_{target}",
            "count": count,
            "duration_ms": duration_ms,
        },
    )
