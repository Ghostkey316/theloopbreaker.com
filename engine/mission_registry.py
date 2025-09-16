"""Mission statement registry backed by authenticated encryption."""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from utils.crypto import decrypt_text, derive_key, encrypt_text
from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "missions.json"
DEFAULT_KEY = os.environ.get("MISSION_KEY", "vaultfire")


def _key_bytes(key: Optional[str]) -> bytes:
    secret = key if key is not None else DEFAULT_KEY
    return derive_key(secret)


def encrypt_mission(mission: str, key: Optional[str] = None) -> str:
    return encrypt_text(_key_bytes(key), mission)


def decrypt_mission(token: str, key: Optional[str] = None) -> str:
    return decrypt_text(_key_bytes(key), token)


# --- Mission registry functions -------------------------------------------

def record_mission(user_id: str, wallet: str, mission: str, key: Optional[str] = None) -> dict:
    """Store encrypted ``mission`` for ``user_id`` and associated ``wallet``."""
    data = load_json(DATA_PATH, {})
    enc = encrypt_mission(mission, key)
    entry = {
        "wallet": wallet,
        "mission": enc,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    data[user_id] = entry
    write_json(DATA_PATH, data)
    return entry


def get_mission(user_id: str, key: Optional[str] = None) -> Optional[str]:
    data = load_json(DATA_PATH, {})
    entry = data.get(user_id)
    if not entry:
        return None
    try:
        return decrypt_mission(entry.get("mission", ""), key)
    except Exception:
        return None


def get_mission_by_wallet(wallet: str, key: Optional[str] = None) -> Optional[str]:
    data = load_json(DATA_PATH, {})
    for entry in data.values():
        if entry.get("wallet") == wallet:
            try:
                return decrypt_mission(entry.get("mission", ""), key)
            except Exception:
                return None
    return None
