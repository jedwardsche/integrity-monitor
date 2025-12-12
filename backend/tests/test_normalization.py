"""Unit tests for normalization utilities."""

import pytest
from backend.utils.normalization import normalize_name, normalize_phone


def test_normalize_name_basic():
    """Test basic name normalization."""
    assert normalize_name("John Smith") == "john smith"
    assert normalize_name("  Jane   Doe  ") == "jane doe"
    assert normalize_name("Mary-Jane Watson") == "mary-jane watson"


def test_normalize_name_unicode():
    """Test normalization handles unicode characters."""
    assert normalize_name("José García") == "jose garcia"
    assert normalize_name("François Müller") == "francois muller"


def test_normalize_name_empty():
    """Test normalization of empty strings."""
    assert normalize_name("") == ""
    assert normalize_name(None) == ""


def test_normalize_phone_basic():
    """Test basic phone normalization."""
    assert normalize_phone("(555) 123-4567") == "+15551234567"
    assert normalize_phone("555-123-4567") == "+15551234567"
    assert normalize_phone("5551234567") == "+15551234567"


def test_normalize_phone_with_country_code():
    """Test phone normalization with country code."""
    assert normalize_phone("+1 555-123-4567") == "+15551234567"
    assert normalize_phone("15551234567") == "+15551234567"


def test_normalize_phone_empty():
    """Test normalization of empty phone numbers."""
    assert normalize_phone("") == ""
    assert normalize_phone(None) == ""


def test_normalize_phone_invalid():
    """Test normalization of invalid phone numbers."""
    assert normalize_phone("abc") == ""
    assert normalize_phone("123") == ""
