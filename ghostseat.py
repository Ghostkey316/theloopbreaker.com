from __future__ import annotations

"""Ghostseat module for watch-mode tracking."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from uuid import uuid4

GHOSTSEAT_REGISTRY_PATH = Path("ghostseat_registry.json")
GHOSTSEAT_REACT_LOG_PATH = Path("ghostseat_react_log.json")
GAME_BOND_TRACKER_PATH = Path("game_bond_tracker.json")


def _load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def assign_seat(identity: str, team: str) -> str:
    """Assign a new Ghostseat ID for ``identity``."""
    registry: Dict[str, List[Dict[str, Any]]] = _load_json(GHOSTSEAT_REGISTRY_PATH, {})
    seat_id = str(uuid4())
    entry = {
        "seat_id": seat_id,
        "team": team,
        "timestamp": datetime.utcnow().isoformat(),
        "nft_badge": False,
    }
    registry.setdefault(identity, []).append(entry)
    _write_json(GHOSTSEAT_REGISTRY_PATH, registry)
    return seat_id


def log_reaction(identity: str, seat_id: str, reaction: str) -> None:
    """Log a cheer or reaction for ``seat_id``."""
    log: List[Dict[str, Any]] = _load_json(GHOSTSEAT_REACT_LOG_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "identity": identity,
        "seat_id": seat_id,
        "reaction": reaction,
    }
    log.append(entry)
    _write_json(GHOSTSEAT_REACT_LOG_PATH, log)


def record_bond(identity: str, team: str, outcome: str) -> None:
    """Record a game bond entry."""
    log: List[Dict[str, Any]] = _load_json(GAME_BOND_TRACKER_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "identity": identity,
        "team": team,
        "outcome": outcome,
    }
    log.append(entry)
    _write_json(GAME_BOND_TRACKER_PATH, log)


__all__ = ["assign_seat", "log_reaction", "record_bond"]
