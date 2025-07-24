# Reference: ethics/core.mdx
"""Update signal feed with scoreboard information."""

import json
import os
from datetime import datetime
from pathlib import Path

from engine.noise_filter import filter_feed

BASE_DIR = Path(__file__).resolve().parent
FEED_PATH = BASE_DIR / "dashboards" / "signal_feed.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    os.makedirs(path.parent, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def update_signal_feed(entry: dict, *, run_filter: bool = True) -> dict:
    log = _load_json(FEED_PATH, [])
    entry_with_time = {"timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), **entry}
    log.append(entry_with_time)
    _write_json(FEED_PATH, log)
    if run_filter:
        filter_feed()
    return entry_with_time


if __name__ == "__main__":
    sample_entry = {
        "top_users": [
            {"user": "ghostkey316", "score": 97.4, "rank": 1, "verified": True},
            {"user": "builder__loop", "score": 89.1, "rank": 2},
        ],
        "ethics_trend": "\u2191",
        "last_payout": "2025-07-20T04:00:00Z",
        "next_unlock": "2025-07-24T12:00:00Z",
    }
    update_signal_feed(sample_entry)
