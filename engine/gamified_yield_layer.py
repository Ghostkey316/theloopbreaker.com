"""Gamified Yield Layer for Vaultfire.

This module links real-world quest completion to protocol rewards. It
keeps track of daily tasks, streaks, cooldowns and level progress for
multiple domains. XP converts to vault points and can trigger yield
boosts via existing modules.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from .purpose_engine import moral_memory_mirror
from .yield_engine_v1 import mark_yield_boost

BASE_DIR = Path(__file__).resolve().parents[1]
PROGRESS_PATH = BASE_DIR / "logs" / "yield_quests.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"

Quest = Dict[str, object]

# Simple quest definitions. "tier" gates quests based on belief milestones.
QUESTS: Dict[str, List[Quest]] = {
    "health": [
        {"id": "hydrate", "desc": "Drink 2L of water", "xp": 10, "tier": 0},
        {"id": "move", "desc": "Log 30 minutes of movement", "xp": 15, "tier": 0},
        {"id": "share_tip", "desc": "Share a wellness tip", "xp": 20, "tier": 1},
    ],
    "crypto": [
        {"id": "read_update", "desc": "Read a crypto security update", "xp": 10, "tier": 0},
        {"id": "practice_tx", "desc": "Run a test transaction", "xp": 15, "tier": 0},
        {"id": "teach_wallet", "desc": "Teach someone wallet safety", "xp": 25, "tier": 1},
    ],
    "growth": [
        {"id": "journal", "desc": "Write a short reflection", "xp": 10, "tier": 0},
        {"id": "learn", "desc": "Study a new skill for 20m", "xp": 15, "tier": 0},
        {"id": "mentor", "desc": "Mentor a newcomer", "xp": 25, "tier": 1},
    ],
    "gaming": [
        {"id": "daily_match", "desc": "Play a quick match", "xp": 10, "tier": 0},
        {"id": "review_replay", "desc": "Review yesterday's game", "xp": 15, "tier": 0},
        {"id": "create_mod", "desc": "Submit a mod idea", "xp": 25, "tier": 1},
    ],
}

DEFAULT_STREAK = {"count": 0, "last_day": "", "protection": 0}


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


def _belief_tier(user_id: str) -> int:
    """Return quest tier based on alignment score."""
    card = _load_json(SCORECARD_PATH, {})
    score = card.get(user_id, {}).get("alignment_score", 0)
    if score >= 200:
        return 1
    return 0


def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


def _record_progress(data: Dict, user_id: str) -> None:
    _write_json(PROGRESS_PATH, data)
    # update purpose engine memory for context
    moral_memory_mirror(user_id)


def _user_entry(data: Dict, user_id: str) -> Dict:
    entry = data.get(user_id)
    if not entry:
        entry = {
            "xp": 0,
            "vault_points": 0,
            "streaks": {},
            "tasks": {},
        }
    data[user_id] = entry
    return entry


def _assign_daily_tasks(entry: Dict, tier: int) -> None:
    today = _today()
    if entry.get("tasks", {}).get("day") == today:
        return
    entry["tasks"] = {"day": today, "domains": {}}
    for domain, quests in QUESTS.items():
        available = [q for q in quests if q.get("tier", 0) <= tier]
        entry["tasks"]["domains"][domain] = [q["id"] for q in available]


def get_daily_tasks(user_id: str) -> Dict:
    """Return today's task list for ``user_id``."""
    data = _load_json(PROGRESS_PATH, {})
    entry = _user_entry(data, user_id)
    tier = _belief_tier(user_id)
    _assign_daily_tasks(entry, tier)
    _record_progress(data, user_id)
    return entry["tasks"]


def _cooldown_ok(entry: Dict, domain: str, quest_id: str) -> bool:
    last = entry.get("last_complete", {}).get(domain, {}).get(quest_id)
    if not last:
        return True
    prev = datetime.fromisoformat(last)
    return datetime.utcnow() - prev >= timedelta(hours=24)


def complete_task(user_id: str, domain: str, quest_id: str) -> Optional[Dict]:
    """Mark ``quest_id`` complete for ``domain`` if cooldown allows."""
    data = _load_json(PROGRESS_PATH, {})
    entry = _user_entry(data, user_id)
    if domain not in QUESTS:
        return None
    all_ids = {q["id"]: q for q in QUESTS[domain]}
    quest = all_ids.get(quest_id)
    if not quest:
        return None
    tier = _belief_tier(user_id)
    if quest.get("tier", 0) > tier:
        return None
    if not _cooldown_ok(entry, domain, quest_id):
        return None

    entry.setdefault("last_complete", {}).setdefault(domain, {})[quest_id] = datetime.utcnow().isoformat()
    entry["xp"] += quest.get("xp", 0)
    streak = entry.setdefault("streaks", {}).setdefault(domain, DEFAULT_STREAK.copy())
    today = _today()
    if streak["last_day"] == today:
        pass
    elif streak["last_day"] and datetime.strptime(today, "%Y-%m-%d") - datetime.strptime(streak["last_day"], "%Y-%m-%d") > timedelta(days=1):
        if streak.get("protection", 0) > 0:
            streak["protection"] -= 1
        else:
            streak["count"] = 0
    else:
        streak["count"] += 1
    streak["last_day"] = today
    if entry["xp"] // 100 > entry.get("vault_points", 0):
        entry["vault_points"] = entry["xp"] // 100
        mark_yield_boost(user_id)
    _record_progress(data, user_id)
    return {"quest": quest_id, "domain": domain, "xp": entry["xp"], "streak": streak["count"]}


def quest_card(user_id: str) -> Dict:
    """Return a summary for the frontend."""
    data = _load_json(PROGRESS_PATH, {})
    entry = _user_entry(data, user_id)
    tier = _belief_tier(user_id)
    _assign_daily_tasks(entry, tier)
    level = entry["xp"] // 100
    return {
        "user_id": user_id,
        "xp": entry["xp"],
        "vault_points": entry.get("vault_points", 0),
        "level": level,
        "tasks": entry["tasks"],
        "streaks": entry.get("streaks", {}),
    }


def add_streak_protection(user_id: str, domain: str, amount: int = 1) -> None:
    data = _load_json(PROGRESS_PATH, {})
    entry = _user_entry(data, user_id)
    streak = entry.setdefault("streaks", {}).setdefault(domain, DEFAULT_STREAK.copy())
    streak["protection"] += amount
    _record_progress(data, user_id)


__all__ = [
    "get_daily_tasks",
    "complete_task",
    "quest_card",
    "add_streak_protection",
]
