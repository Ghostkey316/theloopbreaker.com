"""Vaultfire FIT layer - AI Coach and progress tracking."""
from __future__ import annotations

import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .inventory_storage import add_item
from .token_ops import send_token
from .purpose_engine import moral_memory_mirror

BASE_DIR = Path(__file__).resolve().parents[1]
FIT_LOG = BASE_DIR / "logs" / "fitness_log.json"
MILESTONE_PATH = BASE_DIR / "logs" / "fitness_milestones.json"


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


def _hash(identifier: str) -> str:
    return hashlib.sha256(identifier.encode()).hexdigest()


# ---------------------------------------------------------------------------
# AI Coach logic
# ---------------------------------------------------------------------------

def record_workout(user_id: str, routine: str, metrics: Dict[str, float], verified: bool = False) -> Dict:
    """Record a workout session for ``user_id``."""
    hashed = _hash(user_id)
    log = _load_json(FIT_LOG, {})
    entry = log.get(hashed, {})
    history = entry.setdefault("history", [])
    history.append({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "routine": routine,
        "metrics": metrics,
        "verified": verified,
    })
    log[hashed] = entry
    _write_json(FIT_LOG, log)
    _check_milestone(hashed, routine)
    if verified:
        send_token(user_id, 1.0, "VAULT")
    moral_memory_mirror(user_id)
    return entry


def coach_feedback(user_id: str) -> List[str]:
    """Return simple feedback strings based on recent workouts."""
    hashed = _hash(user_id)
    log = _load_json(FIT_LOG, {}).get(hashed, {})
    history = log.get("history", [])[-5:]
    feedback: List[str] = []
    total_mins = 0.0
    for session in history:
        metrics = session.get("metrics", {})
        total_mins += metrics.get("minutes", 0.0)
    if total_mins < 60:
        feedback.append("Aim for at least 60 minutes of activity this week.")
    else:
        feedback.append("Great job keeping active!")
    return feedback


# ---------------------------------------------------------------------------
# Milestone handling
# ---------------------------------------------------------------------------

def _check_milestone(hashed: str, routine: str) -> None:
    milestones = _load_json(MILESTONE_PATH, {})
    user = milestones.setdefault(hashed, {})
    count = user.get(routine, 0) + 1
    user[routine] = count
    _write_json(MILESTONE_PATH, milestones)
    if count in {5, 10, 25}:
        _mint_milestone_nft(hashed, routine, count)


def _mint_milestone_nft(hashed: str, routine: str, count: int) -> None:
    token_id = f"{routine}-{count}"
    tx = hashlib.sha256(f"{hashed}:{token_id}".encode()).hexdigest()[:10]
    add_item(hashed, token_id, tx)


__all__ = ["record_workout", "coach_feedback"]

