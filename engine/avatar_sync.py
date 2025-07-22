"""Avatar synchronization utilities for players."""

from __future__ import annotations

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
AVATAR_PATH = BASE_DIR / "logs" / "avatars.json"


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


def sync_avatar(user_id: str, avatar_url: str) -> dict:
    """Store ``avatar_url`` for ``user_id``."""
    data = _load_json(AVATAR_PATH, {})
    data[user_id] = avatar_url
    _write_json(AVATAR_PATH, data)
    return {"user_id": user_id, "avatar": avatar_url}


def get_avatar(user_id: str) -> str | None:
    """Return avatar URL for ``user_id`` if known."""
    data = _load_json(AVATAR_PATH, {})
    return data.get(user_id)
