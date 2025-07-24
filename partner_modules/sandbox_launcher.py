from __future__ import annotations

"""Temporary test environments for partners."""

import json
from datetime import datetime, timedelta
from pathlib import Path

from .verifiability_console import record_audit_log

BASE_DIR = Path(__file__).resolve().parents[1]
SANDBOX_PATH = BASE_DIR / "logs" / "sandbox_envs.json"


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


def launch_sandbox(partner_id: str) -> dict:
    """Create a sandbox entry valid for 30 days."""
    envs = _load_json(SANDBOX_PATH, [])
    exp = datetime.utcnow() + timedelta(days=30)
    entry = {
        "partner_id": partner_id,
        "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "expires": exp.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    envs.append(entry)
    _write_json(SANDBOX_PATH, envs)
    record_audit_log({"partner_id": partner_id, "event": "sandbox_launch"})
    return entry


def record_event(partner_id: str, event: str) -> None:
    """Record simulated event for ``partner_id``."""
    record_audit_log({"partner_id": partner_id, "sandbox_event": event})


def cleanup_expired() -> None:
    """Remove expired sandboxes from registry."""
    envs = _load_json(SANDBOX_PATH, [])
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    active = [e for e in envs if e.get("expires", now) > now]
    if active != envs:
        _write_json(SANDBOX_PATH, active)
