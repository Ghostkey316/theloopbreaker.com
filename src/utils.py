from __future__ import annotations

from datetime import datetime, timezone


def get_timestamp() -> str:
    """Return the current UTC timestamp in ISO 8601 format."""

    now = datetime.now(timezone.utc).replace(microsecond=0)
    return now.isoformat()
