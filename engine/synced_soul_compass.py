"""Synced Soul Compass for purpose guidance based on multi-domain signals."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from .wellness_oracle import _avg_sleep, _last_mood
from .gaming_layer import SESSIONS_PATH
from .game_replay import ACTIONS_PATH
from .wallet_loyalty import wallet_tier
from .purpose_engine import generate_purpose_quest

BASE_DIR = Path(__file__).resolve().parents[1]
COMPASS_LOG = BASE_DIR / "logs" / "soul_compass_log.json"
STEWARD_PATH = BASE_DIR / "governance" / "stewards.json"
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


# ---------------------------------------------------------------------------
# Signal helpers
# ---------------------------------------------------------------------------

def _health_signals(user_id: str) -> Dict[str, float]:
    sleep_avg = _avg_sleep(user_id)
    mood = _last_mood(user_id)
    stress = None
    if mood is not None:
        stress = 5 - mood
    return {"sleep_avg": sleep_avg or 0.0, "stress": stress if stress is not None else 0.0}


def _gaming_signals(user_id: str) -> Dict[str, float]:
    actions = _load_json(ACTIONS_PATH, [])
    user_actions = [a for a in actions if a.get("user_id") == user_id]
    choices = len(user_actions)
    coop_actions = len([a for a in user_actions if str(a.get("decision")).lower() == "cooperate"])

    sessions = _load_json(SESSIONS_PATH, [])
    collab_sessions = sum(
        1 for s in sessions if user_id in s.get("players", []) and len(s.get("players", [])) > 1
    )
    collaboration = coop_actions + collab_sessions
    return {"choices": choices, "collaboration": collaboration}


def _crypto_signals(user_id: str) -> Dict[str, str]:
    stewards = _load_json(STEWARD_PATH, [])
    is_steward = user_id in stewards
    scorecard = _load_json(SCORECARD_PATH, {}).get(user_id, {})
    wallet = scorecard.get("wallet")
    tier = wallet_tier(wallet) if wallet else "default"
    return {"steward": str(is_steward), "commitment_tier": tier}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def update_soul_compass(user_id: str) -> Dict[str, List[str]]:
    """Return updated guidance and quests based on recent signals."""
    health = _health_signals(user_id)
    gaming = _gaming_signals(user_id)
    crypto = _crypto_signals(user_id)

    guidance: List[str] = []
    quests: List[str] = []

    if health["sleep_avg"] < 6:
        guidance.append("Prioritize rest to regain clarity.")
        quests.append("Rest Quest: log 7+ hours of sleep for 3 nights.")
    if health["stress"] > 2:
        guidance.append("Take time to decompress and manage stress.")
        quests.append("Reflection: note your top stress triggers today.")

    if gaming["collaboration"] > 0:
        guidance.append("Leverage teamwork from recent games.")
        quests.append("Co-op Quest: plan a collaborative challenge.")
    if gaming["choices"] > 10:
        guidance.append("Reflect on how your decisions shape outcomes.")
        quests.append("Reflection: which choices felt aligned?")

    if crypto["steward"] == "True":
        guidance.append("Your stewardship role inspires community trust.")
        quests.append("Steward Quest: mentor a newcomer this week.")
    if crypto["commitment_tier"] != "default":
        guidance.append(f"Loyalty tier {crypto['commitment_tier']} shows commitment.")

    quests.append(generate_purpose_quest(user_id))

    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "guidance": guidance,
        "quests": quests,
    }

    log = _load_json(COMPASS_LOG, [])
    log.append(entry)
    _write_json(COMPASS_LOG, log)

    return {"guidance": guidance, "quests": quests}


__all__ = ["update_soul_compass"]
