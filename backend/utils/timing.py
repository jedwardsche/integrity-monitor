"""Timing utilities for run stages."""

from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Dict


@contextmanager
def timed(stage: str, metrics: Dict[str, int]):
    start = time.time()
    try:
        yield
    finally:
        metrics[f"duration_{stage}"] = int((time.time() - start) * 1000)
