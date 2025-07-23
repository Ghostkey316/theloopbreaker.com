"""Squad Layer for Vaultfire.

This module builds on the social layer so contributors can form
purpose-driven squads, earn squad XP and complete squad quests.
Yield or status multipliers grow as squads maintain loyalty and
synergy among members.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from .social_layer import create_squad, add_member, remove_member
from .loyalty_multiplier import loyalty_multiplier

BASE_DIR = Path(__file__).resolve().parents[1]
SQUAD_DIR = BASE_DIR / "logs" / "squad_layer"
XP_PATH = SQUAD_DIR / "xp.json"
QUEST_PATH = SQUAD_DIR / "quests.json"


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


# ---------------------------------------------------------------------------
# Squad XP tracking
# ---------------------------------------------------------------------------

def _xp_state() -> Dict:
    return _load_json(XP_PATH, {})


def _save_xp(state: Dict) -> None:
    _write_json(XP_PATH, state)


def record_xp(squad_id: str, user_id: str, amount: int) -> None:
    """Add ``amount`` XP to ``squad_id`` and ``user_id``."""
    state = _xp_state()
    squad = state.setdefault(squad_id, {"total": 0, "members": {}, "log": []})
    squad["total"] += amount
    squad["members"][user_id] = squad["members"].get(user_id, 0) + amount
    squad["log"].append({
        "user": user_id,
        "xp": amount,
        "time": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    state[squad_id] = squad
    _save_xp(state)


# ---------------------------------------------------------------------------
# Quests
# ---------------------------------------------------------------------------

def issue_squad_quest(squad_id: str, quest_id: str, desc: str, xp: int = 10) -> Dict:
    """Create a new quest for ``squad_id``."""
    quests = _load_json(QUEST_PATH, {})
    squad_q = quests.setdefault(squad_id, {})
    if quest_id in squad_q:
        return {"message": "exists"}
    entry = {"desc": desc, "xp": xp, "completions": []}
    squad_q[quest_id] = entry
    _write_json(QUEST_PATH, quests)
    return entry


def complete_squad_quest(squad_id: str, user_id: str, quest_id: str) -> Optional[Dict]:
    """Mark ``quest_id`` complete for ``user_id``."""
    quests = _load_json(QUEST_PATH, {})
    squad_q = quests.get(squad_id, {})
    quest = squad_q.get(quest_id)
    if not quest:
        return None
    quest.setdefault("completions", []).append({
        "user": user_id,
        "time": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    _write_json(QUEST_PATH, quests)
    xp = quest.get("xp", 0)
    record_xp(squad_id, user_id, xp)
    return {"squad": squad_id, "quest": quest_id, "xp": xp}


# ---------------------------------------------------------------------------
# Multipliers
# ---------------------------------------------------------------------------

def squad_multiplier(squad_id: str) -> float:
    """Return yield/status multiplier for ``squad_id``."""
    state = _xp_state()
    info = state.get(squad_id)
    if not info:
        return 1.0
    base = 1.0 + min(info.get("total", 0), 1000) / 1000.0
    members = info.get("members", {})
    if not members:
        return round(base, 3)
    mults = [loyalty_multiplier(u) for u in members]
    synergy = sum(mults) / len(mults)
    return round(base * synergy, 3)


__all__ = [
    "record_xp",
    "issue_squad_quest",
    "complete_squad_quest",
    "squad_multiplier",
]
