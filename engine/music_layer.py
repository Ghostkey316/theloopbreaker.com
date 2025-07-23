"""Vaultfire Music Layer"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .health_sync_engine import encrypt_data, decrypt_data

BASE_DIR = Path(__file__).resolve().parents[1]
MUSIC_DIR = BASE_DIR / "logs" / "music"
IDENTITY_PATH = MUSIC_DIR / "music_identity.json"
MEMORY_PATH = MUSIC_DIR / "memory_tracks.json"
NFT_PATH = MUSIC_DIR / "music_nfts.json"
SIGNAL_SYNC_PATH = MUSIC_DIR / "signal_syncs.json"


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


# ---------------------------------------------------------------------------
# Service connections and identity
# ---------------------------------------------------------------------------

def connect_service(user_id: str, service: str, token: str) -> None:
    """Record hashed API token for ``service`` connection."""
    data = _load_json(IDENTITY_PATH, {})
    user = data.get(user_id, {})
    services = user.get("services", {})
    services[service] = hashlib.sha256(token.encode()).hexdigest()
    user["services"] = services
    data[user_id] = user
    _write_json(IDENTITY_PATH, data)


def pull_top_tracks(user_id: str, service: str) -> List[Dict]:
    """Placeholder for pulling top tracks from ``service``."""
    # Real implementation would call streaming APIs. This stub returns
    # sample tracks so downstream functions can operate.
    sample = [
        {"id": "track001", "genre": "ambient"},
        {"id": "track002", "genre": "ambient"},
        {"id": "track003", "genre": "lofi"},
    ]
    return sample


def build_music_identity(user_id: str, tracks: List[Dict]) -> Dict:
    """Update identity profile based on ``tracks``."""
    data = _load_json(IDENTITY_PATH, {})
    user = data.setdefault(user_id, {})
    genres: Dict[str, int] = user.get("genres", {})
    for t in tracks:
        g = t.get("genre", "unknown")
        genres[g] = genres.get(g, 0) + 1
    user["genres"] = genres
    user["top_tracks"] = [t.get("id") for t in tracks[:10]]
    data[user_id] = user
    _write_json(IDENTITY_PATH, data)
    return user


# ---------------------------------------------------------------------------
# Signal and memory tracks
# ---------------------------------------------------------------------------

def attach_track_to_signal(signal_id: str, track_id: str, squad: Optional[str] = None) -> None:
    """Link ``track_id`` to ``signal_id`` and update squad sync counts."""
    data = _load_json(SIGNAL_SYNC_PATH, {})
    entry = data.get(track_id, {"count": 0, "squads": {}})
    entry["count"] += 1
    if squad:
        entry["squads"][squad] = entry["squads"].get(squad, 0) + 1
    data[track_id] = entry
    _write_json(SIGNAL_SYNC_PATH, data)


def record_memory_track(user_id: str, track_id: str, milestone: str, key: str) -> Dict:
    """Store encrypted milestone memory linked to ``track_id``."""
    data = _load_json(MEMORY_PATH, {})
    records = data.get(user_id, [])
    token = encrypt_data(f"{track_id}|{milestone}", key)
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data": token,
    }
    records.append(entry)
    data[user_id] = records
    _write_json(MEMORY_PATH, data)
    return entry


def get_memory_tracks(user_id: str, key: str) -> List[Dict]:
    """Return decrypted memory tracks for ``user_id``."""
    data = _load_json(MEMORY_PATH, {}).get(user_id, [])
    results = []
    for rec in data:
        try:
            plain = decrypt_data(rec.get("data", ""), key)
            track_id, milestone = plain.split("|", 1)
            results.append({
                "track": track_id,
                "milestone": milestone,
                "timestamp": rec.get("timestamp"),
            })
        except Exception:
            continue
    return results


# ---------------------------------------------------------------------------
# Limited-edition NFTs and AI playlists
# ---------------------------------------------------------------------------

def issue_music_nft(user_id: str, track_id: str, mission_id: str) -> Dict:
    """Record a mission-based music NFT unlock."""
    data = _load_json(NFT_PATH, [])
    entry = {
        "user": user_id,
        "track": track_id,
        "mission": mission_id,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    data.append(entry)
    _write_json(NFT_PATH, data)
    return entry


def ai_curated_playlist(user_id: str) -> List[str]:
    """Return a simple evolving playlist for ``user_id``."""
    identity = _load_json(IDENTITY_PATH, {}).get(user_id, {})
    genres = identity.get("genres", {})
    if not genres:
        return ["ambient_track_1"]
    top = max(genres, key=genres.get)
    return [f"{top}_track_{i}" for i in range(1, 6)]

