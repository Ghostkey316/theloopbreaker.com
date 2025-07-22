"""AI-driven helper to align users with a personal mission."""
from __future__ import annotations

import json
import random
import hashlib
from pathlib import Path
from datetime import datetime
from typing import List, Dict

BASE_DIR = Path(__file__).resolve().parents[1]
PURPOSE_PATH = BASE_DIR / "logs" / "purpose_profiles.json"
PARTNERS_PATH = BASE_DIR / "partners.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
ENGAGEMENT_PATH = BASE_DIR / "logs" / "engagement_data.json"
EVENT_LOG_PATH = BASE_DIR / "event_log.json"
MORAL_MEMORY_PATH = BASE_DIR / "logs" / "moral_memory.json"
FINGERPRINT_PATH = BASE_DIR / "logs" / "behavioral_fingerprint.json"
LIFE_PATHS_STATE_PATH = BASE_DIR / "logs" / "life_path_state.json"

LIFE_PATHS: Dict[str, Dict[str, List[str]]] = {
    "leader": {
        "quests": ["rally a team", "draft a vision"],
        "alliances": ["governance circle"],
        "evolution": ["strategist", "visionary", "architect"],
    },
    "builder": {
        "quests": ["prototype a tool", "improve infrastructure"],
        "alliances": ["makers guild"],
        "evolution": ["engineer", "architect", "master builder"],
    },
    "healer": {
        "quests": ["share a remedy", "host a wellness check"],
        "alliances": ["curewatch network"],
        "evolution": ["mentor", "sage", "lifekeeper"],
    },
    "protector": {
        "quests": ["secure a resource", "safeguard a peer"],
        "alliances": ["guardian core"],
        "evolution": ["warden", "shield", "legend"],
    },
    "artist": {
        "quests": ["create a piece", "collaborate on a mural"],
        "alliances": ["creative collective"],
        "evolution": ["storyteller", "influencer", "cultural beacon"],
    },
    "teacher": {
        "quests": ["share a lesson", "mentor an apprentice"],
        "alliances": ["knowledge guild"],
        "evolution": ["guide", "master", "luminary"],
    },
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


def simulate_life_path(path: str) -> Dict:
    """Preview quests, alliances and evolution for ``path``."""
    info = LIFE_PATHS.get(path)
    if not info:
        raise ValueError("unknown life path")
    return {"path": path, **info}


def commit_life_path(user_id: str, path: str) -> Dict:
    """Commit ``user_id`` to a life path and persist the choice."""
    info = simulate_life_path(path)
    state = _load_json(LIFE_PATHS_STATE_PATH, {})
    state[user_id] = {
        "path": path,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _write_json(LIFE_PATHS_STATE_PATH, state)
    return {"user_id": user_id, **info}


def _hash_identifier(identifier: str) -> str:
    return hashlib.sha256(identifier.encode()).hexdigest()


def analyze_actions(user_id: str) -> Dict[str, float]:
    """Analyze onchain and offchain actions for ``user_id``."""
    events = _load_json(EVENT_LOG_PATH, [])
    onchain = len([e for e in events if e.get("user_id") == user_id])

    engagement = _load_json(ENGAGEMENT_PATH, {})
    metrics = engagement.get(_hash_identifier(user_id), {})
    offchain = float(sum(metrics.get(k, 0) for k in metrics.keys()))

    return {"onchain_actions": onchain, "offchain_score": offchain}


def _generate_behavioral_fingerprint(history: List[Dict]) -> Dict:
    if not history:
        return {"alignment_avg": 0.0, "action_score": 0.0, "fingerprint": ""}

    align_avg = sum(e.get("alignment", 0.0) for e in history) / len(history)
    action_score = sum(
        e.get("actions", {}).get("onchain_actions", 0) +
        e.get("actions", {}).get("offchain_score", 0.0)
        for e in history
    )
    token = f"{align_avg:.2f}:{action_score:.2f}"
    fingerprint = hashlib.sha256(token.encode()).hexdigest()
    return {
        "alignment_avg": align_avg,
        "action_score": action_score,
        "fingerprint": fingerprint,
    }


def moral_memory_mirror(user_id: str) -> Dict:
    """Update memory history and return the behavioral fingerprint."""
    actions = analyze_actions(user_id)
    scorecard = _load_json(SCORECARD_PATH, {})
    alignment = scorecard.get(user_id, {}).get("alignment_score", 0.0)

    memory = _load_json(MORAL_MEMORY_PATH, {})
    history = memory.get(user_id, [])
    history.append({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "alignment": alignment,
        "actions": actions,
    })
    memory[user_id] = history[-50:]
    _write_json(MORAL_MEMORY_PATH, memory)

    fingerprint = _generate_behavioral_fingerprint(memory[user_id])
    data = _load_json(FINGERPRINT_PATH, {})
    data[user_id] = fingerprint
    _write_json(FINGERPRINT_PATH, data)
    return fingerprint


__all__ = [
    "record_traits",
    "discover_purpose",
    "generate_purpose_quest",
    "suggest_partner_communities",
    "tailor_experience",
    "analyze_actions",
    "moral_memory_mirror",
    "simulate_life_path",
    "commit_life_path",
]
