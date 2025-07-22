"""Mirror avatar traits from contract events."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

BASE_DIR = Path(__file__).resolve().parents[1]
PROFILE_PATH = BASE_DIR / "logs" / "mirrored_avatars.json"
EVENTS_PATH = BASE_DIR / "logs" / "avatar_events.json"


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


def _update_profile(profile: Dict, event_type: str, data: Dict[str, Any]) -> Dict:
    if event_type == "stat_change":
        stats = profile.setdefault("stats", {})
        for key, val in data.items():
            stats[key] = stats.get(key, 0) + float(val)
    elif event_type == "trait_update":
        traits = profile.setdefault("traits", {})
        traits.update(data)
    elif event_type == "quest_alignment":
        profile["quest"] = data.get("quest", profile.get("quest"))
    return profile


def record_avatar_event(user_id: str, event_type: str, data: Dict[str, Any]) -> Dict:
    """Record a contract event and mirror updates into the avatar profile."""
    events: List[Dict] = _load_json(EVENTS_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "event": event_type,
        "data": data,
    }
    events.append(entry)
    _write_json(EVENTS_PATH, events)

    profiles: Dict[str, Dict] = _load_json(PROFILE_PATH, {})
    profile = profiles.get(user_id, {})
    profile = _update_profile(profile, event_type, data)
    profiles[user_id] = profile
    _write_json(PROFILE_PATH, profiles)
    return profile


def get_mirrored_profile(user_id: str) -> Dict | None:
    """Return the mirrored avatar profile for ``user_id``."""
    data: Dict[str, Dict] = _load_json(PROFILE_PATH, {})
    return data.get(user_id)
