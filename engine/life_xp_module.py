"""Life XP module for rewarding growth-oriented activities."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from .ethical_growth_engine import learning_multiplier
from .vaultlink import record_interaction

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "life_xp.json"


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


def _log(entry: dict) -> None:
    log = _load_json(LOG_PATH, [])
    log.append(entry)
    _write_json(LOG_PATH, log)


def reward_lesson(user_id: str, lesson_id: str, key: str, passed: bool = True) -> dict:
    """Record lesson completion and update companion memory."""
    base_xp = 2.0 if passed else 1.0
    record_interaction(user_id, f"lesson:{lesson_id}", "learning", base_xp, passed, key)
    mult = learning_multiplier(user_id)
    xp_gain = round(base_xp * mult, 2)
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "lesson_id": lesson_id,
        "passed": passed,
        "xp": xp_gain,
    }
    _log(entry)
    return entry


def reward_idea(user_id: str, idea_id: str, key: str) -> dict:
    """Reward exploring a new idea."""
    base_xp = 1.5
    record_interaction(user_id, f"idea:{idea_id}", "learning", base_xp, False, key)
    mult = learning_multiplier(user_id)
    xp_gain = round(base_xp * mult, 2)
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "idea_id": idea_id,
        "xp": xp_gain,
    }
    _log(entry)
    return entry


def total_xp(user_id: str) -> float:
    """Return total Life XP for ``user_id``."""
    log = _load_json(LOG_PATH, [])
    return round(sum(e.get("xp", 0) for e in log if e.get("user_id") == user_id), 2)


__all__ = ["reward_lesson", "reward_idea", "total_xp"]
