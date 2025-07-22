"""Wellness Oracle module for personalized guidance."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "logs" / "wellness"
SLEEP_PATH = DATA_DIR / "sleep_log.json"
HYDRATION_PATH = DATA_DIR / "hydration_log.json"
MOOD_PATH = DATA_DIR / "mood_log.json"
QUEST_PATH = DATA_DIR / "quest_log.json"


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


# --- Sleep tracking ---------------------------------------------------------

def record_sleep(identifier: str, hours: float) -> None:
    """Record nightly sleep hours for ``identifier``."""
    log = _load_json(SLEEP_PATH, {})
    entries = log.get(identifier, [])
    entries.append({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "hours": hours,
    })
    log[identifier] = entries[-7:]
    _write_json(SLEEP_PATH, log)


def _avg_sleep(identifier: str) -> float | None:
    data = _load_json(SLEEP_PATH, {}).get(identifier)
    if not data:
        return None
    total = sum(entry.get("hours", 0.0) for entry in data)
    return total / len(data)


# --- Hydration tracking ----------------------------------------------------

def record_hydration(identifier: str, amount_liters: float) -> None:
    """Add ``amount_liters`` consumed for ``identifier`` today."""
    log = _load_json(HYDRATION_PATH, {})
    today = datetime.utcnow().strftime("%Y-%m-%d")
    user = log.get(identifier, {})
    user[today] = user.get(today, 0.0) + amount_liters
    log[identifier] = user
    _write_json(HYDRATION_PATH, log)


def _today_hydration(identifier: str) -> float | None:
    log = _load_json(HYDRATION_PATH, {}).get(identifier)
    if not log:
        return None
    today = datetime.utcnow().strftime("%Y-%m-%d")
    return log.get(today, 0.0)


# --- Mental wellness check-ins --------------------------------------------

def record_checkin(identifier: str, mood: int, note: str = "") -> None:
    """Record a simple mood check-in."""
    log = _load_json(MOOD_PATH, {})
    entries = log.get(identifier, [])
    entries.append({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mood": mood,
        "note": note,
    })
    log[identifier] = entries[-30:]
    _write_json(MOOD_PATH, log)


def _last_mood(identifier: str) -> int | None:
    entries = _load_json(MOOD_PATH, {}).get(identifier)
    if not entries:
        return None
    return entries[-1].get("mood")


# --- Wellness guidance and quests -----------------------------------------

def wellness_guidance(identifier: str) -> List[str]:
    """Return simple wellness suggestions."""
    guidance: List[str] = []
    avg_sleep = _avg_sleep(identifier)
    today_water = _today_hydration(identifier)
    mood = _last_mood(identifier)
        
    if avg_sleep is not None and avg_sleep < 7:
        guidance.append("Aim for at least 7 hours of sleep. Try winding down earlier.")
    if today_water is not None and today_water < 2:
        guidance.append("You're below 2L of water today. Take a hydration break.")
    if mood is not None and mood < 3:
        guidance.append("Check in with yourself—consider a short meditation or talk with a friend.")

    return guidance


def generate_health_quest(identifier: str) -> str:
    """Create a simple health quest based on recent behavior."""
    guidance = wellness_guidance(identifier)
    if not guidance:
        quest = "Keep up the good work! Maintain your healthy habits."
    elif any("sleep" in g.lower() for g in guidance):
        quest = "Sleep Quest: log at least 7 hours for the next 3 nights."
    elif any("hydration" in g.lower() for g in guidance):
        quest = "Hydration Quest: drink at least 2L of water for the next 3 days."
    else:
        quest = "Mind Quest: take 5 minutes daily for meditation for one week."

    log = _load_json(QUEST_PATH, {})
    entries = log.get(identifier, [])
    entries.append({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "quest": quest,
    })
    log[identifier] = entries
    _write_json(QUEST_PATH, log)
    return quest


if __name__ == "__main__":
    # Basic demo
    record_sleep("demo", 6.5)
    record_hydration("demo", 0.5)
    record_checkin("demo", 2, "tired")
    print(json.dumps(wellness_guidance("demo"), indent=2))
    print(generate_health_quest("demo"))
