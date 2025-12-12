"""Pytest configuration and shared fixtures."""

import json
import os
from pathlib import Path
from typing import Dict, List

import pytest


@pytest.fixture
def fixtures_dir() -> Path:
    """Return path to test fixtures directory."""
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_students(fixtures_dir: Path) -> List[Dict]:
    """Load sample student records from fixtures."""
    fixture_path = fixtures_dir / "students.json"
    if fixture_path.exists():
        with open(fixture_path) as f:
            return json.load(f)
    return []


@pytest.fixture
def sample_parents(fixtures_dir: Path) -> List[Dict]:
    """Load sample parent records from fixtures."""
    fixture_path = fixtures_dir / "parents.json"
    if fixture_path.exists():
        with open(fixture_path) as f:
            return json.load(f)
    return []


@pytest.fixture
def sample_attendance(fixtures_dir: Path) -> List[Dict]:
    """Load sample attendance records from fixtures."""
    fixture_path = fixtures_dir / "attendance.json"
    if fixture_path.exists():
        with open(fixture_path) as f:
            return json.load(f)
    return []


@pytest.fixture
def sample_records(sample_students, sample_parents, sample_attendance) -> Dict[str, List[Dict]]:
    """Combine all sample records into a records dictionary."""
    return {
        "students": sample_students,
        "parents": sample_parents,
        "attendance": sample_attendance,
        "contractors": [],
        "classes": [],
    }


@pytest.fixture
def golden_dir(fixtures_dir: Path) -> Path:
    """Return path to golden files directory."""
    return fixtures_dir / "golden"
