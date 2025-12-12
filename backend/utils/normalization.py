"""Normalization helpers (names, emails, phones)."""

import re
import unicodedata


def normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode()
    return " ".join(normalized.lower().split())


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return ""
    if not digits.startswith("1") and len(digits) == 10:
        digits = f"1{digits}"
    return f"+{digits}" if len(digits) >= 10 else ""
