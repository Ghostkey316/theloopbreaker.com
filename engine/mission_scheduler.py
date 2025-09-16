"""Vaultcore mission scheduler and reward aggregator."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Mapping, Optional

from .alignment_guard import evaluate_alignment
from .purpose_engine import generate_purpose_quest

BASE_DIR = Path(__file__).resolve().parents[1]
SCHEDULE_PATH = BASE_DIR / "logs" / "daily_missions.json"
SETTINGS_PATH = BASE_DIR / "logs" / "mission_settings.json"
POINTS_PATH = BASE_DIR / "logs" / "vault_points.json"
GOALS_PATH = BASE_DIR / "user_goals.json"

MISSION_TYPES: Dict[str, list[str]] = {
    "health": ["hydrate", "stretch", "log_nutrition"],
    "finance": ["review_budget", "track_expenses"],
    "creativity": ["journal", "sketch"],
    "rest": ["meditate", "sleep_early"],
    "relationship": ["check_in", "offer_help"],
}


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


def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


def sync_mode(user_id: str) -> bool:
    settings = _load_json(SETTINGS_PATH, {})
    return bool(settings.get(user_id, {}).get("sync_enabled", True))


def set_sync_mode(user_id: str, enabled: bool) -> None:
    settings = _load_json(SETTINGS_PATH, {})
    entry = settings.get(user_id, {})
    entry["sync_enabled"] = bool(enabled)
    settings[user_id] = entry
    _write_json(SETTINGS_PATH, settings)


def _user_schedule(data: Dict, user_id: str) -> Dict:
    entry = data.get(user_id)
    if not entry:
        entry = {}
        data[user_id] = entry
    return entry


def assign_daily_mission(user_id: str, *, identity: Optional[Mapping[str, Any]] = None) -> Optional[Dict]:
    if not sync_mode(user_id):
        return None
    data = _load_json(SCHEDULE_PATH, {})
    entry = _user_schedule(data, user_id)
    today = _today()
    if entry.get("day") == today:
        return entry
    mission = generate_purpose_quest(user_id)
    guard_identity = dict(identity) if isinstance(identity, Mapping) else {"user_id": user_id}
    guard_identity.setdefault("user_id", user_id)
    guard_payload = {
        "mission": mission,
        "declared_purpose": mission,
        "mission_tags": ["daily-mission"],
        "belief_density": 1.0,
        "empathy_score": guard_identity.get("empathyScore") or guard_identity.get("empathy_score") or 0.72,
    }
    guard_result = evaluate_alignment(
        "mission.assign_daily",
        guard_payload,
        identity=guard_identity,
    )
    guard_summary = {
        "decision": guard_result["decision"],
        "reasons": guard_result["reasons"],
        "override": guard_result["override"],
        "drift": guard_result["drift"],
    }
    if not guard_result["allowed"]:
        entry.update(
            {
                "day": today,
                "mission": None,
                "status": guard_result["decision"],
                "reason": "; ".join(guard_result["reasons"]) or guard_result["decision"],
                "alignment_guard": guard_summary,
            }
        )
        _write_json(SCHEDULE_PATH, data)
        return entry
    entry.update({"day": today, "mission": mission, "alignment_guard": guard_summary})
    _write_json(SCHEDULE_PATH, data)
    return entry


def record_reward(user_id: str, domain: str, amount: int) -> None:
    points = _load_json(POINTS_PATH, {})
    entry = points.get(user_id, {})
    entry[domain] = entry.get(domain, 0) + int(amount)
    points[user_id] = entry
    _write_json(POINTS_PATH, points)


def aggregated_points(user_id: str) -> int:
    points = _load_json(POINTS_PATH, {})
    return sum(points.get(user_id, {}).values())


def dashboard_snapshot(user_id: str) -> Dict:
    mission = assign_daily_mission(user_id) or {}
    return {
        "user_id": user_id,
        "mission": mission,
        "vault_points": aggregated_points(user_id),
    }

__all__ = [
    "assign_daily_mission",
    "record_reward",
    "aggregated_points",
    "dashboard_snapshot",
    "set_sync_mode",
    "sync_mode",
    "MISSION_TYPES",
]
