"""Optional health sync engine for Vaultfire profiles."""
from __future__ import annotations

import base64
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
SYNC_DIR = BASE_DIR / "logs" / "health_sync"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
SYNC_LOG_PATH = BASE_DIR / "logs" / "health_sync_log.json"


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


# --- lightweight XOR encryption -------------------------------------------

def _xor_cipher(data: bytes, key: str) -> bytes:
    key_bytes = key.encode()
    return bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(data))


def encrypt_data(text: str, key: str) -> str:
    cipher = _xor_cipher(text.encode(), key)
    return base64.urlsafe_b64encode(cipher).decode()


def decrypt_data(token: str, key: str) -> str:
    data = base64.urlsafe_b64decode(token.encode())
    plain = _xor_cipher(data, key)
    return plain.decode()


def _hash_id(identifier: str) -> str:
    return hashlib.sha256(identifier.encode()).hexdigest()


# --- reward handling ------------------------------------------------------

def _reward_user(user_id: str, points: float = 1.0) -> None:
    scorecard = _load_json(SCORECARD_PATH, {})
    user = scorecard.get(user_id, {})
    user["wellness_points"] = user.get("wellness_points", 0.0) + points
    scorecard[user_id] = user
    _write_json(SCORECARD_PATH, scorecard)


# --- wearable data -------------------------------------------------------

def link_wearable_data(user_id: str, metrics: Dict[str, float], key: str) -> Dict:
    """Store encrypted wearable metrics for ``user_id``."""
    hashed = _hash_id(user_id)
    path = SYNC_DIR / f"{hashed}_wearable.json"
    enc = encrypt_data(json.dumps(metrics), key)
    _write_json(path, {"data": enc})
    _reward_user(user_id)
    _log_entry({"user": hashed, "type": "wearable"})
    return metrics


def get_wearable_data(user_id: str, key: str) -> Optional[Dict[str, float]]:
    hashed = _hash_id(user_id)
    path = SYNC_DIR / f"{hashed}_wearable.json"
    data = _load_json(path, {})
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
    data = _load_json(path, {"entries": []})
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
    _write_json(path, {"entries": entries_enc})
    _reward_user(user_id)
    _log_entry({"user": hashed, "type": "journal"})
    entries.append({"timestamp": timestamp, "text": text})
    return entries


def get_journal_entries(user_id: str, key: str) -> List[Dict]:
    hashed = _hash_id(user_id)
    path = SYNC_DIR / f"{hashed}_journal.json"
    data = _load_json(path, {"entries": []})
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
    log = _load_json(SYNC_LOG_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    log.append({"timestamp": timestamp, **entry})
    _write_json(SYNC_LOG_PATH, log)

