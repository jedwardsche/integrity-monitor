"""Unit tests for duplicate detection."""

import pytest
from backend.checks.duplicates import run, _extract_field


def test_extract_field():
    """Test field extraction with various key formats."""
    fields = {"Name": "John", "Last Name": "Smith", "email_address": "test@example.com"}
    
    assert _extract_field(fields, "Name") == "John"
    assert _extract_field(fields, "name") == "John"
    assert _extract_field(fields, "last_name") == "Smith"
    assert _extract_field(fields, "email", "email_address") == "test@example.com"
    assert _extract_field(fields, "missing") is None


def test_duplicate_detection_students(sample_students):
    """Test duplicate detection on sample student records."""
    records = {"students": sample_students, "parents": [], "contractors": []}
    issues = run(records)
    
    # Should detect duplicates between recStudent1 and recStudent2 (John/Jon Smith)
    student_duplicates = [i for i in issues if i.entity == "student" and i.issue_type == "duplicate"]
    assert len(student_duplicates) > 0
    
    # Check that likely duplicates are flagged
    likely_dups = [i for i in student_duplicates if i.severity == "warning"]
    assert len(likely_dups) > 0


def test_duplicate_detection_no_duplicates():
    """Test duplicate detection with no duplicates."""
    records = {
        "students": [
            {"id": "s1", "fields": {"Name": "Alice", "Email": "alice@example.com"}},
            {"id": "s2", "fields": {"Name": "Bob", "Email": "bob@example.com"}},
        ],
        "parents": [],
        "contractors": [],
    }
    issues = run(records)
    duplicates = [i for i in issues if i.issue_type == "duplicate"]
    assert len(duplicates) == 0


def test_duplicate_detection_empty():
    """Test duplicate detection with empty records."""
    records = {"students": [], "parents": [], "contractors": []}
    issues = run(records)
    assert len(issues) == 0
