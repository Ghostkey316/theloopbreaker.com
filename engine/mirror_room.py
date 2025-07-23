"""Mirror Rooms module for private or group conversations."""
from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List

from .vaultlink import record_mirror_entry  # type: ignore
from .purpose_engine import moral_memory_mirror  # type: ignore
from vaultfire_signal_parser import parse_signal  # type: ignore

BASE_DIR = Path(__file__).resolve().parents[1]
ROOM_DIR = BASE_DIR / "logs" / "mirror_rooms"
LOOP_HISTORY_PATH = BASE_DIR / "logs" / "loop_history.json"


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


def _room_path(room_id: str) -> Path:
    return ROOM_DIR / f"{room_id}.json"


def create_room(room_id: str, topic: str, participants: List[str], private: bool = True) -> Dict:
    """Create a Mirror Room or return existing metadata."""
    path = _room_path(room_id)
    if path.exists():
        return _load_json(path, {})
    data = {
        "room_id": room_id,
        "topic": topic,
        "participants": participants,
        "private": private,
        "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "messages": [],
    }
    _write_json(path, data)
    return data


def _update_loop_history(user_id: str, loops: int) -> None:
    hist = _load_json(LOOP_HISTORY_PATH, {})
    hist[user_id] = hist.get(user_id, 0) + loops
    _write_json(LOOP_HISTORY_PATH, hist)


def post_message(room_id: str, user_id: str, text: str) -> Dict:
    """Add a message to a Mirror Room and sync companion state."""
    path = _room_path(room_id)
    data = _load_json(path, None)
    if not data:
        raise ValueError("room not found")
    loops = parse_signal(text).get("loop_activators", 0)
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user": user_id,
        "text": text,
        "loops": loops,
    }
    data.setdefault("messages", []).append(entry)
    data["messages"] = data["messages"][-500:]
    _write_json(path, data)
    record_mirror_entry(user_id, text)
    moral_memory_mirror(user_id)
    _update_loop_history(user_id, loops)
    return entry


def get_transcript(room_id: str) -> List[Dict]:
    """Return the message history for ``room_id``."""
    data = _load_json(_room_path(room_id), None)
    if not data:
        raise ValueError("room not found")
    return data.get("messages", [])


__all__ = ["create_room", "post_message", "get_transcript"]
