"""Deployment status helpers for Vaultfire agents."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict

StatusMap = Dict[str, str]

_STATUS_PATH = Path("status") / "agent_status.json"


def _load_status_map() -> StatusMap:
    if not _STATUS_PATH.exists():
        return {}
    try:
        with open(_STATUS_PATH) as stream:
            data = json.load(stream)
    except json.JSONDecodeError:
        return {}
    if isinstance(data, dict):
        return {str(key): str(value) for key, value in data.items()}
    return {}


def _write_status_map(mapping: StatusMap) -> None:
    _STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_STATUS_PATH, "w") as stream:
        json.dump(mapping, stream, indent=2, sort_keys=True)


def get_agent_status(*, agent_id: str) -> str:
    """Return the recorded deployment status for ``agent_id``.

    Falls back to ``"pending"`` when no prior state is available.  The helper
    never raises to make it safe for background tasks such as beacon sync
    loops.
    """

    status = _load_status_map().get(agent_id)
    return status or "pending"


def set_agent_status(*, agent_id: str, status: str) -> None:
    """Persist a deployment ``status`` for ``agent_id``."""

    mapping = _load_status_map()
    mapping[agent_id] = status
    _write_status_map(mapping)


__all__ = ["get_agent_status", "set_agent_status"]
