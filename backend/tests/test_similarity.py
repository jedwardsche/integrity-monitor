"""Unit tests for similarity utilities."""

import pytest
from backend.utils.similarity import jaro_winkler, jaccard_ratio


def test_jaro_winkler_identical():
    """Test Jaro-Winkler with identical strings."""
    assert jaro_winkler("john", "john") == 1.0
    assert jaro_winkler("", "") == 1.0


def test_jaro_winkler_similar():
    """Test Jaro-Winkler with similar strings."""
    score = jaro_winkler("john", "jon")
    assert 0.8 < score < 1.0


def test_jaro_winkler_different():
    """Test Jaro-Winkler with different strings."""
    score = jaro_winkler("john", "mary")
    assert 0.0 <= score < 0.5


def test_jaro_winkler_empty():
    """Test Jaro-Winkler with empty strings."""
    assert jaro_winkler("", "john") == 0.0
    assert jaro_winkler("john", "") == 0.0


def test_jaro_winkler_prefix_bonus():
    """Test Jaro-Winkler gives bonus for common prefix."""
    score1 = jaro_winkler("john", "johnny")
    score2 = jaro_winkler("mary", "johnny")
    assert score1 > score2


def test_jaccard_ratio_identical():
    """Test Jaccard ratio with identical sets."""
    assert jaccard_ratio(["a", "b", "c"], ["a", "b", "c"]) == 1.0


def test_jaccard_ratio_partial():
    """Test Jaccard ratio with partial overlap."""
    assert jaccard_ratio(["a", "b"], ["b", "c"]) == pytest.approx(1.0 / 3.0)


def test_jaccard_ratio_no_overlap():
    """Test Jaccard ratio with no overlap."""
    assert jaccard_ratio(["a", "b"], ["c", "d"]) == 0.0


def test_jaccard_ratio_empty():
    """Test Jaccard ratio with empty sets."""
    assert jaccard_ratio([], ["a"]) == 0.0
    assert jaccard_ratio(["a"], []) == 0.0
    assert jaccard_ratio([], []) == 0.0


def test_jaccard_ratio_filters_none():
    """Test Jaccard ratio filters None values."""
    assert jaccard_ratio(["a", None, "b"], ["b", None, "c"]) == pytest.approx(1.0 / 3.0)
