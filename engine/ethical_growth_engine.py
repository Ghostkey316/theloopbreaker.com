"""Ethical Growth Engine for Vaultlink.

This module enforces the Ghostkey Ethics Framework during
Vaultlink's learning process. Intelligence upgrades only occur
when alignment and belief metrics meet the required threshold.
"""

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime

from .loyalty_multiplier import loyalty_multiplier
from .signal_engine import calculate_alignment_score
from .expansion_guard import enforce_preservation

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
MIRROR_PATH = BASE_DIR / "logs" / "moral_mirror.json"
OVERRIDE_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "override_consensus.json"

ALIGN_THRESHOLD = 75
BELIEF_THRESHOLD = 1


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


def belief_score(user_id: str) -> float:
    card = _load_json(SCORECARD_PATH, {})
    return float(card.get(user_id, {}).get("belief_level", 0))


def ethics_passed(user_id: str) -> bool:
    align = calculate_alignment_score(user_id)
    belief = belief_score(user_id)
    return align >= ALIGN_THRESHOLD and belief >= BELIEF_THRESHOLD


def learning_multiplier(user_id: str) -> float:
    mult = loyalty_multiplier(user_id)
    card = _load_json(SCORECARD_PATH, {})
    info = card.get(user_id, {})
    trust = info.get("trust_behavior", 0)
    if trust < 0:
        return 0.0
    return round(mult * (1 + trust / 100.0), 3)


def record_mirror_entry(user_id: str, text: str) -> None:
    """Store interaction text for human reflection."""
    data = _load_json(MIRROR_PATH, {})
    history = data.get(user_id, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "text": text,
        "ethics_score": calculate_alignment_score(user_id),
        "origin": "reflection_mirror",
    }
    history.append(entry)
    data[user_id] = enforce_preservation(
        "reflection_mirror",
        history,
        entry=entry,
        user_id=user_id,
    )
    _write_json(MIRROR_PATH, data)


def asi_activation_allowed() -> bool:
    info = _load_json(OVERRIDE_PATH, {})
    return bool(info.get("asi_override"))


__all__ = [
    "belief_score",
    "ethics_passed",
    "learning_multiplier",
    "record_mirror_entry",
    "asi_activation_allowed",
]
