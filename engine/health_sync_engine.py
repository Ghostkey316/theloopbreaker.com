"""Optional health sync engine for Vaultfire profiles."""
from __future__ import annotations

import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from utils.crypto import decrypt_text, derive_key, encrypt_text
from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parents[1]
SYNC_DIR = BASE_DIR / "logs" / "health_sync"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
SYNC_LOG_PATH = BASE_DIR / "logs" / "health_sync_log.json"


def _key_bytes(key: str) -> bytes:
    """Derive a stable AES key from ``key`` for profile encryption."""

    return derive_key(key)


def encrypt_data(text: str, key: str) -> str:
    return encrypt_text(_key_bytes(key), text)


def decrypt_data(token: str, key: str) -> str:
    return decrypt_text(_key_bytes(key), token)


def _hash_id(identifier: str) -> str:
    return hashlib.sha256(identifier.encode()).hexdigest()


# --- reward handling ------------------------------------------------------

def _reward_user(user_id: str, points: float = 1.0) -> None:
    scorecard = load_json(SCORECARD_PATH, {})
    user = scorecard.get(user_id, {})
    user["wellness_points"] = user.get("wellness_points", 0.0) + points
    scorecard[user_id] = user
    write_json(SCORECARD_PATH, scorecard)


# --- wearable data -------------------------------------------------------

def link_wearable_data(user_id: str, metrics: Dict[str, float], key: str) -> Dict:
    """Store encrypted wearable metrics for ``user_id``."""
    hashed = _hash_id(user_id)
    path = SYNC_DIR / f"{hashed}_wearable.json"
    enc = encrypt_data(json.dumps(metrics), key)
    write_json(path, {"data": enc})
    _reward_user(user_id)
    _log_entry({"user": hashed, "type": "wearable"})
    return metrics


def get_wearable_data(user_id: str, key: str) -> Optional[Dict[str, float]]:
    hashed = _hash_id(user_id)
    path = SYNC_DIR / f"{hashed}_wearable.json"
    data = load_json(path, {})
    token = data.get("data")
    if not token:
        return None
    try:
        plain = decrypt_data(token, key)
        return json.loads(plain)
    except Exception:
        return None


# --- journal data --------------------------------------------------------

def link_journal_entry(user_id: str, text: str, key: str) -> List[Dict]:
    """Append encrypted journal entry for ``user_id``."""
    hashed = _hash_id(user_id)
    path = SYNC_DIR / f"{hashed}_journal.json"
    data = load_json(path, {"entries": []})
    entries_enc = data.get("entries", [])
    entries = []
    for token in entries_enc:
        try:
            entry_text = decrypt_data(token, key)
            ts, body = entry_text.split("|", 1)
            entries.append({"timestamp": ts, "text": body})
        except Exception:
            continue
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    token = encrypt_data(f"{timestamp}|{text}", key)
    entries_enc.append(token)
    write_json(path, {"entries": entries_enc})
    _reward_user(user_id)
    _log_entry({"user": hashed, "type": "journal"})
    entries.append({"timestamp": timestamp, "text": text})
    return entries


def get_journal_entries(user_id: str, key: str) -> List[Dict]:
    hashed = _hash_id(user_id)
    path = SYNC_DIR / f"{hashed}_journal.json"
    data = load_json(path, {"entries": []})
    results = []
    for token in data.get("entries", []):
        try:
            entry_text = decrypt_data(token, key)
            ts, body = entry_text.split("|", 1)
            results.append({"timestamp": ts, "text": body})
        except Exception:
            continue
    return results


# --- logging -------------------------------------------------------------

def _log_entry(entry: dict) -> None:
    log = load_json(SYNC_LOG_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    log.append({"timestamp": timestamp, **entry})
    write_json(SYNC_LOG_PATH, log)

