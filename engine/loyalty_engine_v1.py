"""Vaultfire Loyalty Engine v1.0.

Tracks contributor interactions, overlay state and partner sync data.
Logs streak counts and returns a summary with ghostscore alignment.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict

from .ens_overlay import resolve_overlay
from .ghostscore_engine import get_ghostscore

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "loyalty_log.json"
STREAK_PATH = BASE_DIR / "logs" / "loyalty_streaks.json"
PARTNER_PATH = BASE_DIR / "partners.json"
RETRO_PATH = BASE_DIR / "retroactive_rewards.json"


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


def _update_streak(user_id: str) -> int:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    data = _load_json(STREAK_PATH, {})
    info = data.get(user_id, {"last": "", "count": 0})
    if info["last"] != today:
        if info["last"]:
            try:
                prev = datetime.strptime(info["last"], "%Y-%m-%d")
                if datetime.utcnow() - prev <= timedelta(days=1):
                    info["count"] += 1
                else:
                    info["count"] = 1
            except ValueError:
                info["count"] = 1
        else:
            info["count"] = 1
        info["last"] = today
        data[user_id] = info
        _write_json(STREAK_PATH, data)
    return info["count"]


def _retro_multiplier(user_id: str) -> float:
    rewards = _load_json(RETRO_PATH, {})
    return float(rewards.get(user_id, {}).get("multiplier", 1.0))


def record_interaction(user_id: str, action: str, overlay: Optional[str] = None, partner_id: Optional[str] = None) -> Dict:
    """Record a contributor interaction and update streak."""
    streak = _update_streak(user_id)
    overlay_resolved = overlay or resolve_overlay(user_id)
    partners = {p.get("partner_id") for p in _load_json(PARTNER_PATH, [])}
    partner_synced = partner_id in partners if partner_id else False
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "action": action,
        "overlay": overlay_resolved,
        "partner_sync": partner_synced,
        "streak": streak,
    }
    log = _load_json(LOG_PATH, [])
    log.append(entry)
    _write_json(LOG_PATH, log)
    return entry


def loyalty_report(user_id: str) -> Dict:
    """Return a loyalty status report for ``user_id``."""
    streak_data = _load_json(STREAK_PATH, {}).get(user_id, {"count": 0})
    overlay = resolve_overlay(user_id)
    ens = overlay or user_id
    ghostscore = get_ghostscore(ens)
    partners = {p.get("partner_id") for p in _load_json(PARTNER_PATH, [])}
    partner_synced = user_id in partners
    retro_mult = _retro_multiplier(user_id)
    drop_score = streak_data.get("count", 0) * retro_mult
    return {
        "user_id": user_id,
        "streak": streak_data.get("count", 0),
        "overlay": overlay,
        "partner_synced": partner_synced,
        "ghostscore": ghostscore,
        "retro_multiplier": retro_mult,
        "drop_score": drop_score,
    }


__all__ = ["record_interaction", "loyalty_report"]
