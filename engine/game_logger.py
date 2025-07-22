"""Record learning outcomes, achievements and loyalty boosts."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict

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


def log_outcome(user_id: str, game_id: str, outcome: Dict,
                achievements: List[str] | None = None,
                loyalty_boost: float = 0.0) -> Dict:
    """Store gameplay result and update user scorecard."""
    log = _load_json(LOG_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "game_id": game_id,
        "outcome": outcome,
        "achievements": achievements or [],
        "loyalty_boost": loyalty_boost,
    }
    log.append(entry)
    _write_json(LOG_PATH, log)

    scorecard = _load_json(SCORECARD_PATH, {})
    info = scorecard.get(user_id, {})
    info["loyalty"] = info.get("loyalty", 0) + loyalty_boost
    ach = info.get("achievements", [])
    ach.extend(a for a in (achievements or []) if a not in ach)
    info["achievements"] = ach
    scorecard[user_id] = info
    _write_json(SCORECARD_PATH, scorecard)
    return entry
