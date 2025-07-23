"""Vaultfire FitSync module.

This optional layer connects fitness providers and wearables to
the Vaultfire reward system. It validates workouts with a basic
"Proof of Sweat" check and distributes Vault Points accordingly.
Providers can register custom validators to plug in additional
devices or APIs.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable, Dict, List, Optional

from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "logs" / "fit_sync"
CONNECTIONS_PATH = DATA_DIR / "connections.json"
WORKOUT_PATH = DATA_DIR / "workouts.json"
TEAM_PATH = DATA_DIR / "team_challenges.json"
STREAK_PATH = DATA_DIR / "streaks.json"

# Provider name to validator callable
_VALIDATORS: Dict[str, Callable[[Dict[str, float]], bool]] = {}


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


def register_validator(provider: str, func: Callable[[Dict[str, float]], bool]) -> None:
    """Register a custom proof-of-sweat validator."""
    _VALIDATORS[provider] = func


def connect_provider(user_id: str, provider: str, token: str) -> Dict:
    """Store a hashed access token for ``provider``."""
    data = _load_json(CONNECTIONS_PATH, {})
    hashed = hashlib.sha256(f"{user_id}:{provider}".encode()).hexdigest()
    data[hashed] = {
        "provider": provider,
        "token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _write_json(CONNECTIONS_PATH, data)
    return {"message": "connected", "provider": provider}


def _validate(provider: str, metrics: Dict[str, float]) -> bool:
    func = _VALIDATORS.get(provider)
    if func:
        try:
            return bool(func(metrics))
        except Exception:
            return False
    # default check
    minutes = metrics.get("minutes", 0)
    hr = metrics.get("avg_hr", 0)
    return minutes >= 10 and hr >= 80


def _log_workout(user_id: str, entry: Dict) -> None:
    data = _load_json(WORKOUT_PATH, {})
    user = data.setdefault(user_id, [])
    user.append(entry)
    data[user_id] = user[-50:]
    _write_json(WORKOUT_PATH, data)


def _update_streak(user_id: str) -> int:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    data = _load_json(STREAK_PATH, {})
    entry = data.get(user_id, {"last": "", "count": 0})
    if entry["last"] != today:
        if entry["last"]:
            prev = datetime.strptime(entry["last"], "%Y-%m-%d")
            if datetime.utcnow() - prev > timedelta(days=1):
                entry["count"] = 1
            else:
                entry["count"] += 1
        else:
            entry["count"] = 1
        entry["last"] = today
    data[user_id] = entry
    _write_json(STREAK_PATH, data)
    return entry["count"]


def record_workout_sync(user_id: str, provider: str, metrics: Dict[str, float]) -> Dict:
    """Record a workout session and reward if validated."""
    verified = _validate(provider, metrics)
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "provider": provider,
        "metrics": metrics,
        "verified": verified,
    }
    _log_workout(user_id, entry)
    if verified:
        reward = metrics.get("points", 1.0)
        send_token(user_id, reward, "VAULT")
        _update_streak(user_id)
    return entry


def start_team_challenge(challenge_id: str, members: List[str], goal_minutes: float) -> Dict:
    """Create a simple team challenge shared across ``members``."""
    data = _load_json(TEAM_PATH, {})
    if challenge_id in data:
        return {"message": "exists"}
    entry = {
        "members": members,
        "goal": goal_minutes,
        "progress": {m: 0.0 for m in members},
        "active": True,
    }
    data[challenge_id] = entry
    _write_json(TEAM_PATH, data)
    return entry


def record_team_progress(challenge_id: str, user_id: str, minutes: float) -> Optional[Dict]:
    data = _load_json(TEAM_PATH, {})
    chal = data.get(challenge_id)
    if not chal or not chal.get("active"):
        return None
    if user_id not in chal["progress"]:
        return None
    chal["progress"][user_id] += minutes
    total = sum(chal["progress"].values())
    if total >= chal["goal"]:
        chal["active"] = False
        for member in chal["members"]:
            send_token(member, 1.0, "VAULT")
    data[challenge_id] = chal
    _write_json(TEAM_PATH, data)
    return chal


__all__ = [
    "register_validator",
    "connect_provider",
    "record_workout_sync",
    "start_team_challenge",
    "record_team_progress",
]
