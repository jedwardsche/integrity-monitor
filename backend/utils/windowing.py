"""Window helpers for attendance calculations."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Iterable, List


def rolling_window(dates: Iterable[datetime], days: int) -> List[List[datetime]]:
    sorted_dates = sorted(dates)
    windows: List[List[datetime]] = []
    start = 0
    for idx, current in enumerate(sorted_dates):
        while start <= idx and (current - sorted_dates[start]).days >= days:
            start += 1
        windows.append(sorted_dates[start : idx + 1])
    return windows


def count_in_window(dates: Iterable[date], window_days: int, anchor: date) -> int:
    return sum(1 for d in dates if 0 <= (anchor - d).days < window_days)
