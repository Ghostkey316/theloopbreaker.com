# Reference: ethics/core.mdx
"""Mission statement registry with simple XOR-based encryption."""

import json
import os
import base64
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "missions.json"
DEFAULT_KEY = os.environ.get("MISSION_KEY", "vaultfire")


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


# --- Very lightweight XOR cipher (not secure) ------------------------------

def _xor_cipher(text: str, key: str) -> bytes:
    key_bytes = key.encode()
    data_bytes = text.encode()
    return bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(data_bytes))


def encrypt_mission(mission: str, key: str | None = None) -> str:
    key = key or DEFAULT_KEY
    cipher = _xor_cipher(mission, key)
    return base64.urlsafe_b64encode(cipher).decode()


def decrypt_mission(token: str, key: str | None = None) -> str:
    key = key or DEFAULT_KEY
    data = base64.urlsafe_b64decode(token.encode())
    plain = bytes(b ^ key.encode()[i % len(key) ] for i, b in enumerate(data))
    return plain.decode()


# --- Mission registry functions -------------------------------------------

def record_mission(user_id: str, wallet: str, mission: str, key: str | None = None) -> dict:
    """Store encrypted ``mission`` for ``user_id`` and associated ``wallet``."""
    data = _load_json(DATA_PATH, {})
    enc = encrypt_mission(mission, key)
    entry = {"wallet": wallet, "mission": enc, "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")}
    data[user_id] = entry
    _write_json(DATA_PATH, data)
    return entry


def get_mission(user_id: str, key: str | None = None) -> str | None:
    data = _load_json(DATA_PATH, {})
    entry = data.get(user_id)
    if not entry:
        return None
    try:
        return decrypt_mission(entry.get("mission", ""), key)
    except Exception:
        return None


def get_mission_by_wallet(wallet: str, key: str | None = None) -> str | None:
    data = _load_json(DATA_PATH, {})
    for uid, entry in data.items():
        if entry.get("wallet") == wallet:
            try:
                return decrypt_mission(entry.get("mission", ""), key)
            except Exception:
                return None
    return None


