"""Gameplay replay recorder with on-chain hashing."""

from __future__ import annotations

import json
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parents[1]
ACTIONS_PATH = BASE_DIR / "logs" / "game_actions.json"
HASHES_PATH = BASE_DIR / "logs" / "onchain_replay_hashes.json"


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


def record_replay_action(user_id: str, game_id: str, decision: str, action: str) -> Dict:
    """Record a single decision and resulting action for replay."""
    log: List[Dict] = _load_json(ACTIONS_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "game_id": game_id,
        "decision": decision,
        "action": action,
    }
    log.append(entry)
    _write_json(ACTIONS_PATH, log)
    return entry


def finalize_replay(user_id: str, game_id: str) -> Dict:
    """Hash recorded actions for a session and save the result on-chain."""
    actions: List[Dict] = _load_json(ACTIONS_PATH, [])
    relevant = [a for a in actions if a.get("user_id") == user_id and a.get("game_id") == game_id]
    blob = json.dumps(relevant, sort_keys=True).encode()
    replay_hash = sha256(blob).hexdigest()
    hashes: List[Dict] = _load_json(HASHES_PATH, [])
    record = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "game_id": game_id,
        "hash": replay_hash,
    }
    hashes.append(record)
    _write_json(HASHES_PATH, hashes)
    return record
