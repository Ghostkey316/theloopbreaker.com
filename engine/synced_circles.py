"""Auto-curated social circles synced from encrypted profile data."""
from __future__ import annotations

import json
import random
import hashlib
from pathlib import Path
from typing import Dict, List

from utils.crypto import decrypt_text, derive_key, encrypt_text
from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parents[1]
CIRCLES_DIR = BASE_DIR / "logs" / "circles"
OPTS_PATH = CIRCLES_DIR / "opt_in.json"
CIRCLES_PATH = CIRCLES_DIR / "circles.json"


def _key_bytes(key: str) -> bytes:
    return derive_key(key)


def encrypt_data(text: str, key: str) -> str:
    return encrypt_text(_key_bytes(key), text)


def decrypt_data(token: str, key: str) -> str:
    return decrypt_text(_key_bytes(key), token)


def _hash_id(identifier: str) -> str:
    return hashlib.sha256(identifier.encode()).hexdigest()


# --- opt-in handling ------------------------------------------------------

def opt_in(user_id: str) -> bool:
    """Opt ``user_id`` into Synced Circles."""
    opts: List[str] = load_json(OPTS_PATH, [])
    if user_id not in opts:
        opts.append(user_id)
        write_json(OPTS_PATH, opts)
    return True


def opt_out(user_id: str) -> bool:
    """Remove ``user_id`` from Synced Circles."""
    opts: List[str] = load_json(OPTS_PATH, [])
    if user_id in opts:
        opts.remove(user_id)
        write_json(OPTS_PATH, opts)
    return True


# --- profile data ---------------------------------------------------------

def link_profile_data(user_id: str, data: Dict, key: str) -> Dict:
    """Store encrypted profile ``data`` for ``user_id``."""
    hashed = _hash_id(user_id)
    path = CIRCLES_DIR / f"{hashed}.json"
    token = encrypt_data(json.dumps(data), key)
    write_json(path, {"data": token})
    return data


# --- circle formation -----------------------------------------------------

def curate_circles(user_keys: Dict[str, str], group_size: int = 5) -> List[List[str]]:
    """Auto-form circles from opted-in users using encrypted profiles."""
    opts: List[str] = load_json(OPTS_PATH, [])
    groups: Dict[str, List[str]] = {}
    for uid in opts:
        key = user_keys.get(uid)
        if not key:
            continue
        hashed = _hash_id(uid)
        path = CIRCLES_DIR / f"{hashed}.json"
        info = load_json(path, {})
        token = info.get("data")
        if not token:
            continue
        try:
            plain = decrypt_data(token, key)
            profile = json.loads(plain)
        except Exception:
            continue
        gkey = str(profile.get("growth_style", "general"))
        groups.setdefault(gkey, []).append(uid)

    circles: List[List[str]] = []
    for members in groups.values():
        random.shuffle(members)
        while members:
            circle = members[:group_size]
            circles.append(circle)
            members = members[group_size:]

    write_json(CIRCLES_PATH, circles)
    return circles


__all__ = [
    "opt_in",
    "opt_out",
    "link_profile_data",
    "curate_circles",
]
