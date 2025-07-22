"""ENS identity overlays for avatars."""

from __future__ import annotations

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
OVERLAY_PATH = BASE_DIR / "logs" / "ens_overlays.json"


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


def overlay_identity(user_id: str, ens_name: str) -> dict:
    """Associate ``user_id`` with ``ens_name``."""
    data = _load_json(OVERLAY_PATH, {})
    data[user_id] = ens_name
    _write_json(OVERLAY_PATH, data)
    return {"user_id": user_id, "ens": ens_name}


def resolve_overlay(user_id: str) -> str | None:
    """Return ENS name overlay for ``user_id``."""
    data = _load_json(OVERLAY_PATH, {})
    return data.get(user_id)
