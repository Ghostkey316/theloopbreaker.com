"""SparkStarter Initiation Layer for Vaultfire."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional

from .vaultlink import record_interaction
from .loyalty_engine import loyalty_score
from .ethical_growth_engine import belief_score

BASE_DIR = Path(__file__).resolve().parents[1]
PREF_PATH = BASE_DIR / "logs" / "sparkstarter_prefs.json"
PING_LOG_PATH = BASE_DIR / "logs" / "sparkstarter_log.json"

MODES = {"silent", "check-in", "companion"}


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


def set_mode(user_id: str, mode: str) -> None:
    """Set engagement ``mode`` for ``user_id``."""
    if mode not in MODES:
        raise ValueError("invalid mode")
    prefs = _load_json(PREF_PATH, {})
    info = prefs.get(user_id, {})
    info["mode"] = mode
    prefs[user_id] = info
    _write_json(PREF_PATH, prefs)


def set_preferences(user_id: str, tone: str, window_hours: int = 4) -> None:
    """Store tone and ping window for ``user_id``."""
    prefs = _load_json(PREF_PATH, {})
    info = prefs.get(user_id, {})
    info["tone"] = tone
    info["window"] = int(window_hours)
    prefs[user_id] = info
    _write_json(PREF_PATH, prefs)


def _should_ping(last: Optional[str], window: int) -> bool:
    if not last:
        return True
    try:
        prev = datetime.strptime(last, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return True
    return datetime.utcnow() - prev >= timedelta(hours=window)


def next_ping(user_id: str, message: str, key: str) -> Optional[Dict]:
    """Record a ping if allowed and return the log entry."""
    prefs = _load_json(PREF_PATH, {})
    info = prefs.get(user_id, {})
    mode = info.get("mode", "check-in")
    if mode == "silent":
        return None
    window = int(info.get("window", 4))
    last = info.get("last_ping")
    if not _should_ping(last, window):
        return None

    loyalty = loyalty_score(user_id)
    belief = belief_score(user_id)
    tone = info.get("tone", "neutral")
    record_interaction(user_id, message, "spark", 0.5, False, key)

    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "mode": mode,
        "tone": tone,
        "loyalty": loyalty.get("tier"),
        "belief": belief,
        "message": message,
    }
    log = _load_json(PING_LOG_PATH, [])
    log.append(entry)
    _write_json(PING_LOG_PATH, log)

    info["last_ping"] = entry["timestamp"]
    prefs[user_id] = info
    _write_json(PREF_PATH, prefs)
    return entry


__all__ = ["set_mode", "set_preferences", "next_ping", "MODES"]
