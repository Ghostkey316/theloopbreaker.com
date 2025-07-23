"""Vaultlink AI companion engine for Vaultfire."""
from __future__ import annotations

import json
import random
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from .health_sync_engine import encrypt_data, decrypt_data
from .reflection_layer import update_emotional_state

BASE_DIR = Path(__file__).resolve().parents[1]
STATE_DIR = BASE_DIR / "logs" / "vaultlink"
USER_LIST_PATH = BASE_DIR / "user_list.json"

# Additional voice styles and moral alignments for the Mythic Identity Engine
VOICE_STYLES = ["calm", "cheerful", "focused", "mysterious"]
MORAL_COMPASS = ["explorer", "guardian", "sage", "visionary"]

# Abilities and traits unlocked as companions level up
ABILITIES: List[str] = [
    "context recall",
    "cross-domain insights",
    "predictive guidance",
    "fitness coaching",
    "financial mentorship",
    "philosophical reflection",
]

TRAITS: List[str] = [
    "loyal",
    "analytical",
    "intuitive",
    "empathetic",
    "strategist",
]


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


def _hash_user(user_id: str) -> str:
    return hashlib.sha256(user_id.encode()).hexdigest()


def _state_path(user_id: str) -> Path:
    return STATE_DIR / f"{_hash_user(user_id)}.json"


def _is_onboarded(user_id: str) -> bool:
    data = _load_json(USER_LIST_PATH, [])
    return user_id in data


def onboard_companion(user_id: str, key: str) -> Dict:
    """Initialize a Vaultlink companion for ``user_id``."""
    if not _is_onboarded(user_id):
        raise ValueError("user not onboarded")
    path = _state_path(user_id)
    if path.exists():
        return _load_json(path, {})
    seed = random.randint(0, 1_000_000)
    soulprint = hashlib.sha256(f"{user_id}-{seed}".encode()).hexdigest()[:16]
    voice = VOICE_STYLES[seed % len(VOICE_STYLES)]
    moral = MORAL_COMPASS[seed % len(MORAL_COMPASS)]
    state = {
        "seed": seed,
        "soulprint": soulprint,
        "voice_style": voice,
        "moral_compass": moral,
        "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "interactions": 0,
        "milestones": 0,
        "xp": 0.0,
        "level": 0,
        "memory": [],
        "memory_history": [],
        "abilities": [],
        "traits": [],
        "last_update": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _write_json(path, state)
    return state


def _calc_level(xp: float) -> int:
    if xp >= 200:
        return 5
    if xp >= 100:
        return 4
    if xp >= 50:
        return 3
    if xp >= 25:
        return 2
    if xp >= 10:
        return 1
    return 0


def record_interaction(
    user_id: str,
    text: str,
    domain: str,
    behavior: float,
    milestone: bool,
    key: str,
) -> Dict:
    """Record an interaction and update growth metrics."""
    path = _state_path(user_id)
    state = _load_json(path, None)
    if not state:
        raise ValueError("companion not initialized")
    now = datetime.utcnow()
    created = datetime.strptime(state["created"], "%Y-%m-%dT%H:%M:%SZ")
    days = (now - created).total_seconds() / 86400
    xp_gain = behavior + days * 0.05
    if milestone:
        state["milestones"] += 1
        xp_gain += 2.0
    state["xp"] += xp_gain
    state["interactions"] += 1
    level_before = state["level"]
    level_now = _calc_level(state["xp"])
    if level_now > level_before:
        state["level"] = level_now
        random.seed(state["seed"] + level_now)
        if level_now <= len(ABILITIES):
            ability = ABILITIES[level_now - 1]
            if ability not in state["abilities"]:
                state["abilities"].append(ability)
        trait = random.choice(TRAITS)
        if trait not in state["traits"]:
            state["traits"].append(trait)
    emotions = update_emotional_state(user_id, text, key)
    entry = f"{now.strftime('%Y-%m-%dT%H:%M:%SZ')}|{domain}|{text}"
    full_token = encrypt_data(entry, key)
    short_token = encrypt_data(f"{domain}|{text}", key)
    mem_limit = 3 + state["level"] * 2
    state.setdefault("memory_history", []).append(full_token)
    state["memory"].append(short_token)
    state["memory"] = state["memory"][-mem_limit:]
    state["last_update"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    _write_json(path, state)
    return {
        "level": state["level"],
        "xp": state["xp"],
        "abilities": state["abilities"],
        "traits": state["traits"],
        "last_emotion": emotions[-1]["emotion"] if emotions else "neutral",
    }


def fetch_state(user_id: str, key: str) -> Dict:
    """Return companion state with decrypted memory."""
    state = _load_json(_state_path(user_id), None)
    if not state:
        raise ValueError("companion not initialized")
    memories = [decrypt_data(m, key) for m in state.get("memory", [])]
    history = [decrypt_data(m, key) for m in state.get("memory_history", [])]
    return {**state, "memory": memories, "memory_history": history}


def transfer_companion_state(
    from_user: str,
    to_user: str,
    from_key: str,
    to_key: str,
) -> Dict:
    """Clone companion state from ``from_user`` to ``to_user``."""
    source = _load_json(_state_path(from_user), None)
    if not source:
        raise ValueError("source companion not initialized")
    dest_path = _state_path(to_user)
    if dest_path.exists():
        raise ValueError("destination already initialized")
    clone = json.loads(json.dumps(source))
    clone["created"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    clone["interactions"] = 0
    clone["xp"] = 0.0
    clone["level"] = 0
    clone["memory"] = []
    clone["memory_history"] = []
    clone["soulprint"] = hashlib.sha256(f"{to_user}-{clone['seed']}".encode()).hexdigest()[:16]
    _write_json(dest_path, clone)
    return fetch_state(to_user, to_key)

