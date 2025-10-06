"""Signal activation utilities for Vaultfire passive tracking.

This module persists lightweight sync trigger state for social platforms and
optionally records an entry in the governance ledger so downstream systems can
audit the activation trail. The API is intentionally small to support simple
automation scripts, e.g.::

    from vaultfire.signals import activate_sync_trigger

    activate_sync_trigger(
        user_tag="Ghostkey316",
        platform="X",
        sync_type="Passive Signal Tracking",
        notify_on_likes=True,
        notify_on_tags=True,
        ledger_tie=True,
    )

The function stores the activation in ``status/sync_triggers.json`` by default
and appends a ``sync-trigger`` record to ``governance-ledger.json`` when ledger
linking is requested. Both paths are configurable via environment variables so
tests or deployments can isolate their own state files.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Mapping

from signal_log import log_signal

SYNC_TRIGGER_PATH_ENV = "VAULTFIRE_SYNC_TRIGGER_PATH"
LEDGER_PATH_ENV = "VAULTFIRE_GOVERNANCE_LEDGER_PATH"


class SyncTriggerError(RuntimeError):
    """Raised when activation parameters fail validation."""


@dataclass
class _SyncTriggerRecord:
    user_tag: str
    platform: str
    sync_type: str
    notify_on_likes: bool
    notify_on_tags: bool
    ledger_tie: bool
    status: str
    activated_at: str
    ledger_reference: str | None = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.ledger_reference is None:
            data.pop("ledger_reference")
        return data


def _get_registry_path() -> Path:
    custom = os.getenv(SYNC_TRIGGER_PATH_ENV)
    if custom:
        return Path(custom)
    return Path("status") / "sync_triggers.json"


def _get_ledger_path() -> Path:
    custom = os.getenv(LEDGER_PATH_ENV)
    if custom:
        return Path(custom)
    return Path("governance-ledger.json")


def _current_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_text(name: str, value: Any) -> str:
    if not isinstance(value, str):
        raise SyncTriggerError(f"{name} must be a string")
    trimmed = value.strip()
    if not trimmed:
        raise SyncTriggerError(f"{name} cannot be empty")
    return trimmed


def _ensure_bool(name: str, value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    raise SyncTriggerError(f"{name} must be a boolean value")


def _load_json_mapping(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}
    if isinstance(data, dict):
        return data
    return {}


def _write_json(path: Path, data: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(data), indent=2) + "\n")


def _load_ledger(path: Path) -> list[Dict[str, Any]]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return data
    return []


def _write_ledger(path: Path, entries: list[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(entries, indent=2) + "\n")


def activate_sync_trigger(
    *,
    user_tag: str,
    platform: str,
    sync_type: str,
    notify_on_likes: bool,
    notify_on_tags: bool,
    ledger_tie: bool,
) -> Dict[str, Any]:
    """Register or update a passive sync trigger for a social identity."""

    normalized_user = _ensure_text("user_tag", user_tag)
    normalized_platform = _ensure_text("platform", platform).lower()
    normalized_sync_type = _ensure_text("sync_type", sync_type)
    likes_flag = _ensure_bool("notify_on_likes", notify_on_likes)
    tags_flag = _ensure_bool("notify_on_tags", notify_on_tags)
    ledger_flag = _ensure_bool("ledger_tie", ledger_tie)

    registry_path = _get_registry_path()
    registry = _load_json_mapping(registry_path)

    key = f"{normalized_user}@{normalized_platform}"
    timestamp = _current_timestamp()

    record = _SyncTriggerRecord(
        user_tag=normalized_user,
        platform=normalized_platform,
        sync_type=normalized_sync_type,
        notify_on_likes=likes_flag,
        notify_on_tags=tags_flag,
        ledger_tie=ledger_flag,
        status="active",
        activated_at=timestamp,
    )

    ledger_reference: str | None = None
    if ledger_flag:
        ledger_path = _get_ledger_path()
        ledger_entries = _load_ledger(ledger_path)
        ledger_entry = {
            "timestamp": timestamp,
            "type": "sync-trigger",
            "actor": normalized_user,
            "details": {
                "platform": normalized_platform,
                "sync_type": normalized_sync_type,
                "notify_on_likes": likes_flag,
                "notify_on_tags": tags_flag,
                "registry_key": key,
            },
        }
        ledger_entries.append(ledger_entry)
        _write_ledger(ledger_path, ledger_entries)
        ledger_reference = ledger_entry["timestamp"]
        record.ledger_reference = ledger_reference

    registry[key] = record.to_dict()
    _write_json(registry_path, registry)

    try:
        log_signal(
            "sync-trigger",
            {
                "user_tag": normalized_user,
                "platform": normalized_platform,
                "sync_type": normalized_sync_type,
                "notify_on_likes": likes_flag,
                "notify_on_tags": tags_flag,
                "ledger_tie": ledger_flag,
                "ledger_reference": ledger_reference,
            },
        )
    except Exception:
        # Signal logging should not block registry updates.
        pass

    return record.to_dict()


__all__ = ["activate_sync_trigger", "SyncTriggerError"]

