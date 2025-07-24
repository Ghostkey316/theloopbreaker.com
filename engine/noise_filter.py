from __future__ import annotations
import json
from pathlib import Path

from vaultfire_signal_parser import parse_signal
from engine.ghostscore_engine import get_ghostscore

BASE_DIR = Path(__file__).resolve().parents[1]
FEED_PATH = BASE_DIR / "dashboards" / "signal_feed.json"
FILTERED_PATH = BASE_DIR / "dashboards" / "signal_filtered.json"
AUDIT_PATH = BASE_DIR / "logs" / "noise_filter_audit.json"


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


def _score_entry(entry: dict) -> int:
    text = json.dumps(entry, sort_keys=True)
    parsed = parse_signal(text)
    base = parsed.get("score", 0)
    user = entry.get("user") or entry.get("identity")
    if user:
        base += int(get_ghostscore(str(user)) / 10)
    return base


def filter_feed(threshold: int = 30, ghostkey_vision: bool = False) -> list[dict]:
    """Filter signal feed and write results."""
    feed = _load_json(FEED_PATH, [])
    filtered = []
    audit = []
    for item in feed:
        score = _score_entry(item)
        item["signal_score"] = score
        if score < threshold:
            item["suppressed"] = True
            if ghostkey_vision:
                filtered.append(item)
            audit.append({
                "timestamp": item.get("timestamp"),
                "reason": "low score",
                "score": score,
            })
        else:
            filtered.append(item)
    _write_json(FILTERED_PATH, filtered)
    if audit:
        log = _load_json(AUDIT_PATH, [])
        log.extend(audit)
        _write_json(AUDIT_PATH, log)
    return filtered


if __name__ == "__main__":
    filter_feed()
