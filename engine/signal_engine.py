from __future__ import annotations

"""Pulse Engine v1.0 — Tracks trust, sync, rewards, and invites."""

import json
import os
from datetime import datetime
from pathlib import Path

from .ghostkey_commandments import GHOSTKEY_COMMANDMENTS
from .sync_protocol import sync_ns3, sync_openai, sync_worldcoin
from .yield_engine_v1 import mark_yield_boost

BASE_DIR = Path(__file__).resolve().parents[1]
USER_LIST_PATH = BASE_DIR / "user_list.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
BROADCAST_PATH = BASE_DIR / "logs" / "signal_engine_log.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    os.makedirs(path.parent, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def log_to_broadcast(entry: dict) -> None:
    log = _load_json(BROADCAST_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    entry_with_time = {"timestamp": timestamp, **entry}
    log.append(entry_with_time)
    _write_json(BROADCAST_PATH, log)


def grant_role(user_id: str, role: str) -> None:
    scorecard = _load_json(SCORECARD_PATH, {})
    user_data = scorecard.get(user_id, {})
    roles = set(user_data.get("roles", []))
    roles.add(role)
    user_data["roles"] = sorted(roles)
    scorecard[user_id] = user_data
    _write_json(SCORECARD_PATH, scorecard)


def reward(user_id: str, reason: str) -> None:
    mark_yield_boost(user_id)
    log_to_broadcast({"action": "reward", "user_id": user_id, "reason": reason})


def calculate_alignment_score(user_id: str) -> float:
    """Sync metrics for ``user_id`` and return combined alignment score."""
    sync_ns3(user_id)
    sync_openai(user_id)
    sync_worldcoin(user_id)

    data = _load_json(SCORECARD_PATH, {}).get(user_id, {})
    quiz_score = data.get("alignment_score", 0)
    behavior_score = data.get("trust_behavior", 0)
    human_verif = data.get("trust_bonus", 0)
    return quiz_score * 0.4 + behavior_score * 0.4 + human_verif * 0.2


def pulse_tick(user_list: list[str] | None = None) -> None:
    if user_list is None:
        user_list = _load_json(USER_LIST_PATH, [])
    for user in user_list:
        score = calculate_alignment_score(user)
        if score > 85:
            grant_role(user, "Signal Holder")
        if score > 95:
            reward(user, "WEEKLY_YIELD_BONUS")
        log_to_broadcast({"user_id": user, "score": score})


if __name__ == "__main__":
    pulse_tick()
