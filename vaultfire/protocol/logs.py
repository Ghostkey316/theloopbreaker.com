"""Telemetry log helpers for Vaultfire simulations."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

_REPO_ROOT = Path(__file__).resolve().parents[2]
_CHAIN_PATH = _REPO_ROOT / "telemetry" / "telemetry_chain.jsonl"


def _load_last_hash() -> str | None:
    if not _CHAIN_PATH.exists():
        return None
    try:
        last_line = _CHAIN_PATH.read_text(encoding="utf-8").strip().splitlines()[-1]
    except IndexError:
        return None
    if not last_line:
        return None
    try:
        payload = json.loads(last_line)
    except json.JSONDecodeError:  # pragma: no cover - corrupt record guard
        return None
    return payload.get("hash")


def log_telemetry_event(
    *,
    wallet_id: str,
    event_type: str,
    mission_id: str,
    metadata: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Append a telemetry event to the local chain log."""

    if not wallet_id or not wallet_id.strip():
        raise ValueError("wallet_id must be provided")
    if not event_type or not event_type.strip():
        raise ValueError("event_type must be provided")
    if not mission_id or not mission_id.strip():
        raise ValueError("mission_id must be provided")

    metadata = metadata or {}
    base_event = {
        "wallet_id": wallet_id.strip(),
        "event_type": event_type.strip(),
        "mission_id": mission_id.strip(),
        "metadata": metadata,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    prev_hash = _load_last_hash()
    hasher = hashlib.sha256()
    hasher.update(json.dumps(base_event, sort_keys=True).encode("utf-8"))
    if prev_hash:
        hasher.update(prev_hash.encode("utf-8"))
    event_hash = hasher.hexdigest()

    record = {
        **base_event,
        "hash": event_hash,
        "prev_hash": prev_hash,
    }

    _CHAIN_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _CHAIN_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")

    return record


__all__ = ["log_telemetry_event"]
