"""String similarity helpers used by duplicate detection."""

from __future__ import annotations

from typing import Iterable


def jaro_winkler(s1: str, s2: str) -> float:
    """Compute Jaro-Winkler similarity between two strings."""
    s1 = s1 or ""
    s2 = s2 or ""
    if not s1 and not s2:
        return 1.0
    if not s1 or not s2:
        return 0.0

    s1_len = len(s1)
    s2_len = len(s2)
    max_dist = int(max(s1_len, s2_len) / 2) - 1

    match = 0
    hash_s1 = [0] * s1_len
    hash_s2 = [0] * s2_len

    for i in range(s1_len):
        start = max(0, i - max_dist)
        end = min(i + max_dist + 1, s2_len)
        for j in range(start, end):
            if hash_s2[j]:
                continue
            if s1[i] != s2[j]:
                continue
            hash_s1[i] = 1
            hash_s2[j] = 1
            match += 1
            break

    if not match:
        return 0.0

    t = 0
    point = 0

    for i in range(s1_len):
        if not hash_s1[i]:
            continue
        while not hash_s2[point]:
            point += 1
        if s1[i] != s2[point]:
            t += 1
        point += 1

    t /= 2
    jaro = (match / s1_len + match / s2_len + (match - t) / match) / 3

    prefix = 0
    max_prefix = 4
    for i in range(min(max_prefix, s1_len, s2_len)):
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break

    return jaro + 0.1 * prefix * (1 - jaro)


def jaccard_ratio(a: Iterable[str], b: Iterable[str]) -> float:
    set_a = set(filter(None, a))
    set_b = set(filter(None, b))
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    if union == 0:
        return 0.0
    return intersection / union
