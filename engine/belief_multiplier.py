"""Belief multiplier calculations for Vaultfire v1.13."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Tuple

BASE_DIR = Path(__file__).resolve().parents[1]
SCORE_PATH = BASE_DIR / "belief_score.json"
TIER_NAMES = ("Spark", "Glow", "Burner", "Immortal Flame")


def _load_json(path: Path) -> dict:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def record_belief_action(user_id: str, action: str) -> None:
    """Update ``belief_score.json`` with ``action`` for ``user_id``."""
    data = _load_json(SCORE_PATH)
    info = data.get(
        user_id,
        {"interactions": 0, "growth_events": 0, "milestones": 0, "flames": 0},
    )
    if action == "interaction":
        info["interactions"] += 1
    elif action == "growth":
        info["growth_events"] += 1
    elif action == "milestone":
        info["milestones"] += 1
    elif action == "flame":
        info["flames"] += 1
    data[user_id] = info
    _write_json(SCORE_PATH, data)


def _score(info: dict) -> int:
    return (
        info.get("interactions", 0)
        + info.get("growth_events", 0) * 2
        + info.get("milestones", 0) * 5
        + info.get("flames", 0) * 10
    )


def belief_multiplier(user_id: str) -> Tuple[float, str]:
    """Return ``(multiplier, tier)`` for ``user_id``."""
    data = _load_json(SCORE_PATH)
    info = data.get(user_id, {})
    total = _score(info)
    if total >= 100:
        tier, mult = TIER_NAMES[3], 1.2
    elif total >= 50:
        tier, mult = TIER_NAMES[2], 1.1
    elif total >= 20:
        tier, mult = TIER_NAMES[1], 1.05
    else:
        tier, mult = TIER_NAMES[0], 1.0
    return mult, tier


__all__ = ["record_belief_action", "belief_multiplier"]
