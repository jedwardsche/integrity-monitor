"""Unit tests for required field validation."""

import pytest
from backend.checks.required_fields import run, _violates
from backend.config.models import SchemaConfig, EntitySchema, FieldRequirement


def test_violates_missing_field():
    """Test violation detection for missing fields."""
    req = FieldRequirement(
        field="Email",
        message="Email is required",
        severity="warning",
    )
    
    assert _violates({}, req) is True
    assert _violates({"Email": "test@example.com"}, req) is False


def test_violates_alternate_fields():
    """Test violation detection with alternate fields."""
    req = FieldRequirement(
        field="Email",
        alternate_fields=["Email Address", "email"],
        message="Email is required",
        severity="warning",
    )
    
    assert _violates({}, req) is True
    assert _violates({"Email": "test@example.com"}, req) is False
    assert _violates({"Email Address": "test@example.com"}, req) is False
    assert _violates({"email": "test@example.com"}, req) is False


def test_required_field_check_missing(sample_records):
    """Test detection of missing required fields."""
    schema = SchemaConfig(
        entities={
            "students": EntitySchema(
                description="Test Student Entity",
                key_identifiers=["Name"],
                identity_fields=["Name", "Email"],
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
    
    # recStudent5 (Mary Johnson) has empty email
    issues = run(sample_records, schema)
    missing_field_issues = [
        i for i in issues
        if i.issue_type == "missing_field"
        and i.record_id == "recStudent5"
        and "Email" in i.rule_id
    ]
    assert len(missing_field_issues) > 0


def test_required_field_check_present(sample_records):
    """Test that present fields don't trigger issues."""
    schema = SchemaConfig(
        entities={
            "students": EntitySchema(
                description="Test Student Entity",
                key_identifiers=["Name"],
                identity_fields=["Name"],
                missing_key_data=[
                    FieldRequirement(
                        field="Name",
                        message="Name is required",
                        severity="critical",
                    )
                ]
            )
        },
        duplicates={},
        metadata={"source": "test", "generated": "now"}
    )
    
    issues = run(sample_records, schema)
    # All sample students have names
    missing_name_issues = [
        i for i in issues
        if i.issue_type == "missing_field" and "Name" in i.rule_id
    ]
    assert len(missing_name_issues) == 0
