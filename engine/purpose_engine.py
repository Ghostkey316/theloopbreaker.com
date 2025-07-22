"""AI-driven helper to align users with a personal mission."""
from __future__ import annotations

import json
import random
from pathlib import Path
from datetime import datetime
from typing import List, Dict

BASE_DIR = Path(__file__).resolve().parents[1]
PURPOSE_PATH = BASE_DIR / "logs" / "purpose_profiles.json"
PARTNERS_PATH = BASE_DIR / "partners.json"


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


def record_traits(user_id: str, traits: List[str]) -> Dict:
    """Store self-described ``traits`` for ``user_id``."""
    data = _load_json(PURPOSE_PATH, {})
    entry = data.get(user_id, {})
    entry["traits"] = traits
    entry["timestamp"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    data[user_id] = entry
    _write_json(PURPOSE_PATH, data)
    return entry


def discover_purpose(user_id: str, traits: List[str]) -> str:
    """Generate a basic mission suggestion from ``traits``."""
    key_trait = traits[0] if traits else "insight"
    mission = f"Use {key_trait} to uplift your community."
    data = _load_json(PURPOSE_PATH, {})
    entry = data.get(user_id, {})
    entry["mission"] = mission
    data[user_id] = entry
    _write_json(PURPOSE_PATH, data)
    return mission


def generate_purpose_quest(user_id: str) -> str:
    """Create a short quest aligned with the stored mission."""
    data = _load_json(PURPOSE_PATH, {})
    mission = data.get(user_id, {}).get("mission")
    if not mission:
        mission = "clarify your personal purpose"
    quest = f"Purpose Quest: Take one action today to {mission.lower()}"
    entry = data.get(user_id, {})
    quests = entry.get("quests", [])
    quests.append({"timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), "quest": quest})
    entry["quests"] = quests[-10:]
    data[user_id] = entry
    _write_json(PURPOSE_PATH, data)
    return quest


def suggest_partner_communities(user_id: str, count: int = 3) -> List[str]:
    """Return up to ``count`` partner IDs to explore."""
    partners = _load_json(PARTNERS_PATH, [])
    ids = [p.get("partner_id") for p in partners]
    random.shuffle(ids)
    return ids[:count]


def tailor_experience(user_id: str) -> Dict:
    """Suggest Vaultfire modules based on the user's mission."""
    data = _load_json(PURPOSE_PATH, {})
    mission = (data.get(user_id, {}) or {}).get("mission", "").lower()
    features: List[str] = []
    if "health" in mission:
        features.append("wellness_oracle")
    if "game" in mission:
        features.append("vaultfire_arcade")
    if not features:
        features.append("core_dashboard")
    return {"user_id": user_id, "features": features}


__all__ = [
    "record_traits",
    "discover_purpose",
    "generate_purpose_quest",
    "suggest_partner_communities",
    "tailor_experience",
]
