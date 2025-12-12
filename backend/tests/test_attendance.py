"""Unit tests for attendance anomaly detection."""

import pytest
from datetime import date, timedelta
from backend.checks.attendance import run, _normalize_attendance, AttendanceEntry
from backend.config.settings import AttendanceRules, MetricThresholds


def test_normalize_attendance():
    """Test attendance record normalization."""
    records = [
        {
            "id": "att1",
            "fields": {
                "Student": ["recStudent1"],
                "Date": "2024-01-15",
                "Status": "Absent",
                "Minutes Attended": 0,
            },
        }
    ]
    entries = _normalize_attendance(records)
    assert len(entries) == 1
    assert entries[0].student_id == "recStudent1"
    assert entries[0].is_absent is True


def test_attendance_consecutive_absences(sample_records):
    """Test detection of consecutive absences."""
    rules = AttendanceRules(
        thresholds={
            "consecutive_absences": MetricThresholds(warning=3, critical=5),
        }
    )
    
    # recStudent1 has 5 consecutive absences in fixtures
    issues = run(sample_records, rules)
    consecutive_issues = [
        i for i in issues
        if i.issue_type == "attendance"
        and i.record_id == "recStudent1"
        and "consecutive" in i.metadata.get("metric", "")
    ]
    assert len(consecutive_issues) > 0
    # Should be critical (5 absences)
    critical_issues = [i for i in consecutive_issues if i.severity == "critical"]
    assert len(critical_issues) > 0


def test_attendance_absence_rate(sample_records):
    """Test detection of high absence rate."""
    rules = AttendanceRules(
        thresholds={
            "absence_rate_30d": MetricThresholds(warning=0.15, critical=0.25),
        }
    )
    
    issues = run(sample_records, rules)
    absence_rate_issues = [
        i for i in issues
        if i.issue_type == "attendance"
        and "absence_rate" in i.metadata.get("metric", "")
    ]
    # Should detect high absence rate for recStudent1
    assert len(absence_rate_issues) > 0


def test_attendance_no_issues():
    """Test attendance check with no anomalies."""
    records = {
        "attendance": [
            {
                "id": "att1",
                "fields": {
                    "Student": ["s1"],
                    "Date": "2024-01-15",
                    "Status": "Present",
                    "Minutes Attended": 60,
                },
            }
        ],
        "students": [],
    }
    rules = AttendanceRules(thresholds={})
    issues = run(records, rules)
    assert len(issues) == 0
