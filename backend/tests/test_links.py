"""Unit tests for link consistency checks."""

import pytest
from backend.checks.links import run
from backend.config.models import SchemaConfig, EntitySchema, RelationshipRule


def test_link_check_missing_required_link(sample_records):
    """Test detection of missing required links."""
    schema = SchemaConfig(
        entities={
            "students": EntitySchema(
                description="Test Student Entity",
                key_identifiers=["Name"],
                identity_fields=["Name"],
                relationships={
                    "parents": RelationshipRule(
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
    
    # recStudent4 has no parents
    issues = run(sample_records, schema)
    missing_link_issues = [
        i for i in issues
        if i.issue_type == "missing_link" and i.record_id == "recStudent4"
    ]
    assert len(missing_link_issues) > 0


def test_link_check_orphaned_link(sample_records):
    """Test detection of orphaned links."""
    # Add a student with a non-existent parent ID
    records = sample_records.copy()
    records["students"].append({
        "id": "recStudentOrphan",
        "fields": {
            "Name": "Orphan Student",
            "Parents": ["recParent999"],  # Non-existent parent
        }
    })
    
    schema = SchemaConfig(
        entities={
            "students": EntitySchema(
                description="Test Student Entity",
                key_identifiers=["Name"],
                identity_fields=["Name"],
                relationships={
                    "Parents": RelationshipRule(
                        target="parents",
                        message="Student parent link",
                    )
                }
            )
        },
        duplicates={},
        metadata={"source": "test", "generated": "now"}
    )
    
    issues = run(records, schema)
    orphaned_issues = [
        i for i in issues
        if i.issue_type == "orphaned_link" and "recParent999" in str(i.metadata)
    ]
    assert len(orphaned_issues) > 0


def test_link_check_no_issues(sample_records):
    """Test link check with valid links."""
    schema = SchemaConfig(
        entities={
            "students": EntitySchema(
                description="Test Student Entity",
                key_identifiers=["Name"],
                identity_fields=["Name"],
                relationships={
                    "Parents": RelationshipRule(
                        target="parents",
                        min_links=0,  # Optional
                        message="Student parent link",
                    )
                }
            )
        },
        duplicates={},
        metadata={"source": "test", "generated": "now"}
    )
    
    # recStudent1 has valid parent link
    issues = run(sample_records, schema)
    missing_issues = [
        i for i in issues
        if i.issue_type == "missing_link" and i.record_id == "recStudent1"
    ]
    assert len(missing_issues) == 0
