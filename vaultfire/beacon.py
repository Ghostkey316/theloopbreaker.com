"""Beacon helpers for Ghostkey Vaultfire deployments."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Mapping

_STATE_PATH = Path("status") / "beacon_state.json"
_LOG_PATH = Path("status") / "beacon_log.jsonl"


def _load_state() -> Dict[str, Mapping[str, str]]:
    if not _STATE_PATH.exists():
        return {}
    try:
        with open(_STATE_PATH) as stream:
            data = json.load(stream)
    except json.JSONDecodeError:
        return {}
    if isinstance(data, dict):
        return {str(key): dict(value) for key, value in data.items() if isinstance(value, dict)}
    return {}


def _write_state(state: Dict[str, Mapping[str, str]]) -> None:
    _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_STATE_PATH, "w") as stream:
        json.dump(state, stream, indent=2, sort_keys=True)


def update_beacon_light(agent_id: str, color: str) -> Mapping[str, str]:
    """Persist the current beacon ``color`` for ``agent_id`` and return state."""

    state = _load_state()
    payload = {
        "color": color,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    state[agent_id] = payload
    _write_state(state)
    return payload


def log_status(agent_id: str, message: str) -> Mapping[str, str]:
    """Append a structured log entry for ``agent_id`` and return the entry."""

    entry = {
        "agent": agent_id,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_LOG_PATH, "a") as stream:
        stream.write(json.dumps(entry) + "\n")
    return entry


def iter_status_log() -> Iterable[Mapping[str, str]]:
    """Yield log entries in chronological order."""

    if not _LOG_PATH.exists():
        return []
    entries = []
    with open(_LOG_PATH) as stream:
        for line in stream:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return tuple(entries)


__all__ = [
    "iter_status_log",
    "log_status",
    "update_beacon_light",
]
