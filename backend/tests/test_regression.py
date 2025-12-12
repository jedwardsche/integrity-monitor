"""Regression tests comparing fixture outputs to golden files."""

import json
from pathlib import Path
import pytest

from backend.checks import duplicates, links, required_fields, attendance
from backend.config.models import SchemaConfig, EntitySchema, RelationshipRule, FieldRequirement
from backend.config.settings import AttendanceRules, MetricThresholds


def _normalize_issue(issue):
    """Normalize issue for comparison (remove timestamps, etc.)."""
    return {
        "rule_id": issue.rule_id,
        "issue_type": issue.issue_type,
        "entity": issue.entity,
        "record_id": issue.record_id,
        "severity": issue.severity,
        "description": issue.description,
        # Exclude metadata that might vary
    }


def _load_golden(golden_dir: Path, test_name: str):
    """Load golden file for a test."""
    golden_path = golden_dir / f"{test_name}.json"
    if not golden_path.exists():
        return None
    with open(golden_path) as f:
        return json.load(f)


def _save_golden(golden_dir: Path, test_name: str, data):
    """Save golden file for a test."""
    golden_dir.mkdir(parents=True, exist_ok=True)
    golden_path = golden_dir / f"{test_name}.json"
    with open(golden_path, "w") as f:
        json.dump(data, f, indent=2, sort_keys=True)


def test_regression_duplicates(sample_records, golden_dir):
    """Regression test for duplicate detection."""
    records = {
        "students": sample_records.get("students", []),
        "parents": sample_records.get("parents", []),
        "contractors": sample_records.get("contractors", []),
    }
    issues = duplicates.run(records)
    normalized = sorted([_normalize_issue(i) for i in issues], key=lambda x: (x["rule_id"], x["record_id"]))
    
    golden = _load_golden(golden_dir, "duplicates")
    if golden is None:
        # First run - save as golden
        _save_golden(golden_dir, "duplicates", normalized)
        pytest.skip("Golden file created - run test again to verify")
    
    assert normalized == golden, "Duplicate detection output changed - review differences"


def test_regression_links(sample_records, golden_dir):
    """Regression test for link checks."""
    schema = SchemaConfig(
        entities={
            "students": EntitySchema(
                description="Test Student Entity",
                key_identifiers=["Name"],
                identity_fields=["Name"],
                relationships={
                    "Parents": RelationshipRule(
                        target="parents",
                        min_links=1,
                        message="Student must have at least one parent",
                    )
                }
            )
        },
        duplicates={},
        metadata={"source": "test", "generated": "now"}
    )
    
    issues = links.run(sample_records, schema)
    normalized = sorted([_normalize_issue(i) for i in issues], key=lambda x: (x["rule_id"], x["record_id"]))
    
    golden = _load_golden(golden_dir, "links")
    if golden is None:
        _save_golden(golden_dir, "links", normalized)
        pytest.skip("Golden file created - run test again to verify")
    
    assert normalized == golden, "Link check output changed - review differences"


def test_regression_required_fields(sample_records, golden_dir):
    """Regression test for required field checks."""
    schema = SchemaConfig(
        entities={
            "students": EntitySchema(
                description="Test Student Entity",
                key_identifiers=["Name"],
                identity_fields=["Name"],
                missing_key_data=[
                    FieldRequirement(
                        field="Email",
                        message="Email is required for students",
                        severity="warning",
                    )
                ]
            )
        },
        duplicates={},
        metadata={"source": "test", "generated": "now"}
    )
    
    issues = required_fields.run(sample_records, schema)
    normalized = sorted([_normalize_issue(i) for i in issues], key=lambda x: (x["rule_id"], x["record_id"]))
    
    golden = _load_golden(golden_dir, "required_fields")
    if golden is None:
        _save_golden(golden_dir, "required_fields", normalized)
        pytest.skip("Golden file created - run test again to verify")
    
    assert normalized == golden, "Required field check output changed - review differences"


def test_regression_attendance(sample_records, golden_dir):
    """Regression test for attendance anomaly detection."""
    rules = AttendanceRules(
        thresholds={
            "consecutive_absences": MetricThresholds(warning=3, critical=5),
            "absence_rate_30d": MetricThresholds(warning=0.15, critical=0.25),
        }
    )
    
    issues = attendance.run(sample_records, rules)
    normalized = sorted([_normalize_issue(i) for i in issues], key=lambda x: (x["rule_id"], x["record_id"]))
    
    golden = _load_golden(golden_dir, "attendance")
    if golden is None:
        _save_golden(golden_dir, "attendance", normalized)
        pytest.skip("Golden file created - run test again to verify")
    
    assert normalized == golden, "Attendance check output changed - review differences"
