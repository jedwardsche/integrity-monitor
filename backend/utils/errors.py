"""Custom exception classes for integrity runner errors."""

from __future__ import annotations


class IntegrityRunError(Exception):
    """Base exception for integrity run failures."""

    def __init__(self, message: str, run_id: str | None = None, transient: bool = False):
        super().__init__(message)
        self.run_id = run_id
        self.transient = transient


class CheckFailureError(IntegrityRunError):
    """Raised when a specific check module fails."""

    def __init__(self, check_name: str, message: str, run_id: str | None = None):
        super().__init__(f"Check '{check_name}' failed: {message}", run_id=run_id, transient=False)
        self.check_name = check_name


class FetchError(IntegrityRunError):
    """Raised when data fetching fails."""

    def __init__(self, entity: str, message: str, run_id: str | None = None):
        super().__init__(f"Failed to fetch {entity}: {message}", run_id=run_id, transient=True)
        self.entity = entity


class WriteError(IntegrityRunError):
    """Raised when writing results fails."""

    def __init__(self, target: str, message: str, run_id: str | None = None):
        super().__init__(f"Failed to write to {target}: {message}", run_id=run_id, transient=True)
        self.target = target

