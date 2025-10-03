"""Utility modules for shared helper functions."""

from __future__ import annotations

from datetime import datetime, timezone


def get_timestamp() -> str:
    """Return the current UTC timestamp in ISO 8601 format."""

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


__all__ = ["get_timestamp"]
