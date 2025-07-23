
"""Cross-module synergy utilities."""

from datetime import datetime
import json
from pathlib import Path
from typing import Dict

from .gamified_yield_layer import quest_card
from .music_layer import build_music_identity
from .wellness_companion import mood_checkin
from .purpose_engine import moral_memory_mirror

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "synergy_log.json"


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


def record_synergy(user_id: str) -> Dict:
    """Record a simple synergy snapshot across modules."""
    card = quest_card(user_id)
    moral_memory_mirror(user_id)
    mood_checkin(user_id, 3)
    build_music_identity(user_id, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "tasks": card.get("tasks", {}),
    }
    log = _load_json(LOG_PATH, [])
    log.append(entry)
    _write_json(LOG_PATH, log)
    return entry


__all__ = ["record_synergy"]
