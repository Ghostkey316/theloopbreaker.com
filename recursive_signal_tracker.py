"""Recursive signal tracker with belief and ethics checks."""
from __future__ import annotations

import json
from pathlib import Path

from vaultfire_signal_parser import parse_signal
from engine.belief_validation import validate_belief

BASE_DIR = Path(__file__).resolve().parent
FEED_PATH = BASE_DIR / "dashboards" / "signal_feed.json"
ANALYSIS_PATH = BASE_DIR / "dashboards" / "signal_analysis.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def track_signals() -> list[dict]:
    feed = _load_json(FEED_PATH, [])
    log = _load_json(ANALYSIS_PATH, [])
    processed = {e.get("timestamp") for e in log}
    for item in feed:
        ts = item.get("timestamp")
        if not ts or ts in processed:
            continue
        text = json.dumps(item, sort_keys=True)
        parsed = parse_signal(text)
        approved = validate_belief("ghostkey316", text)
        log.append({
            "timestamp": ts,
            "score": parsed.get("score"),
            "verified": parsed.get("verified"),
            "approved": approved,
        })
    _write_json(ANALYSIS_PATH, log)
    return log


if __name__ == "__main__":
    data = track_signals()
    if data:
        print(json.dumps(data[-1], indent=2))
