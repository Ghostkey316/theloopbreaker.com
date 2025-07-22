"""Utilities for caching guest progress and merging into a profile."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "game_outcomes.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"


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


def merge_guest_progress(guest_id: str, user_id: str) -> None:
    """Merge cached progress from ``guest_id`` into ``user_id``."""
    if not guest_id or not user_id or guest_id == user_id:
        return

    log: List[Dict] = _load_json(LOG_PATH, [])
    updated = False
    for entry in log:
        if entry.get("user_id") == guest_id:
            entry["user_id"] = user_id
            updated = True
    if updated:
        _write_json(LOG_PATH, log)

    scorecard: Dict[str, Dict] = _load_json(SCORECARD_PATH, {})
    guest = scorecard.pop(guest_id, None)
    if guest:
        user = scorecard.get(user_id, {})
        for key, value in guest.items():
            if isinstance(value, list):
                combined = set(user.get(key, []))
                combined.update(value)
                user[key] = sorted(combined)
            elif isinstance(value, (int, float)):
                user[key] = user.get(key, 0) + value
            elif key not in user:
                user[key] = value
        scorecard[user_id] = user
        _write_json(SCORECARD_PATH, scorecard)
