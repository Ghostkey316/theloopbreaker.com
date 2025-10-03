from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sys


SRC_PATH = Path(__file__).resolve().parents[1] / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))


from utils import get_timestamp  # noqa: E402


def test_get_timestamp_returns_iso8601_utc() -> None:
    timestamp = get_timestamp()

    parsed = datetime.fromisoformat(timestamp)

    assert parsed.tzinfo == timezone.utc
    assert timestamp.endswith("+00:00")
