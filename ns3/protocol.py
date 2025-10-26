"""Utilities for installing and tracking the NS3 passive yield loop."""
from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from vaultfire.encryption import LegacyDataError, migrate_legacy_file, wrap_mapping

_REPO_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_LOG_PATH = Path(
    os.environ.get("NS3_YIELD_LOG", _REPO_ROOT / "telemetry" / "yield_activation.log")
)
_METADATA_PATH = Path(
    os.environ.get("NS3_METADATA_PATH", _REPO_ROOT / "ghostkey_metadata_snapshot.json")
)

_LEGACY_READ_ONLY = False
_MIGRATION_ATTEMPTED = False
_LEGACY_WARNING = "Legacy Data Unencrypted – Action Required."


@dataclass(slots=True)
class _YieldEvent:
    action: str
    payload: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Return a serialisable representation of the event."""
        return {
            "id": uuid.uuid4().hex,
            "action": self.action,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **self.payload,
        }


def _append_event(event: _YieldEvent) -> Dict[str, Any]:
    record = event.to_dict()
    log_path = _DEFAULT_LOG_PATH
    log_path.parent.mkdir(parents=True, exist_ok=True)
    global _LEGACY_READ_ONLY, _MIGRATION_ATTEMPTED  # noqa: PLW0603
    if not _LEGACY_READ_ONLY and not _MIGRATION_ATTEMPTED:
        try:
            migrate_legacy_file(
                "ns3-sync-log",
                log_path,
                preserve_keys=("id", "action", "timestamp"),
            )
        except LegacyDataError:
            _LEGACY_READ_ONLY = True
        finally:
            _MIGRATION_ATTEMPTED = True
    if _LEGACY_READ_ONLY:
        if not getattr(_append_event, "_warned", False):
            print(_LEGACY_WARNING)
            _append_event._warned = True
        return record
    wrapped = wrap_mapping(
        "ns3-sync-log",
        record,
        preserve_keys=("id", "action", "timestamp"),
    )
    with log_path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(wrapped, sort_keys=True))
        stream.write("\n")
    return record


def _load_origin_metadata() -> Optional[Dict[str, Any]]:
    path = _METADATA_PATH
    if not path.exists():
        return None
    try:
        with path.open(encoding="utf-8") as source:
            return json.load(source)
    except json.JSONDecodeError:
        return None


def install_passive_yield_engine(*, wallet: str) -> Dict[str, Any]:
    """Record the installation of the passive yield engine for a wallet."""
    if not wallet or not wallet.strip():
        raise ValueError("wallet must be provided")

    return _append_event(
        _YieldEvent(
            action="install_passive_yield_engine",
            payload={"wallet": wallet, "status": "installed"},
        )
    )


def sync_behavior_to_loyalty_chain(*, wallet: str, origin: str) -> Dict[str, Any]:
    """Log a loyalty sync alignment for the given wallet and origin."""
    if not wallet or not wallet.strip():
        raise ValueError("wallet must be provided")
    if not origin or not origin.strip():
        raise ValueError("origin must be provided")

    metadata = _load_origin_metadata() or {}
    loyalty_anchor = metadata.get("metadata_lock", {}).get("ens")

    return _append_event(
        _YieldEvent(
            action="sync_behavior_to_loyalty_chain",
            payload={
                "wallet": wallet,
                "origin": origin,
                "loyalty_anchor": loyalty_anchor,
            },
        )
    )


def activate_weekly_yield_distribution(*, start_immediately: bool) -> Dict[str, Any]:
    """Capture activation status for the weekly yield distribution."""
    return _append_event(
        _YieldEvent(
            action="activate_weekly_yield_distribution",
            payload={"start_immediately": bool(start_immediately)},
        )
    )


def validate_origin_rewards(*, origin_id: str) -> Dict[str, Any]:
    """Validate an origin id against the Ghostkey metadata snapshot."""
    if not origin_id or not origin_id.strip():
        raise ValueError("origin_id must be provided")

    metadata = _load_origin_metadata()
    metadata_origin: Optional[str] = None
    if metadata:
        metadata_origin = metadata.get("metadata_lock", {}).get("ens") or metadata.get("ens")
    verified = False
    if metadata_origin:
        metadata_origin_normalized = metadata_origin.split(".")[0].lower()
        if metadata_origin_normalized != origin_id.lower():
            raise ValueError(
                f"origin_id '{origin_id}' does not match registered origin '{metadata_origin}'"
            )
        verified = True

    return _append_event(
        _YieldEvent(
            action="validate_origin_rewards",
            payload={"origin_id": origin_id, "verified": verified},
        )
    )


_MULTIPLIERS = {
    "Genesis": 1.0,
    "Genesis+": 1.12,
    "Genesis++": 1.25,
    "Ascendant": 1.4,
}


def apply_multiplier_for_ghostkey(*, wallet: str, level: str) -> Dict[str, Any]:
    """Apply a belief multiplier tier to the provided wallet."""
    if not wallet or not wallet.strip():
        raise ValueError("wallet must be provided")
    if level not in _MULTIPLIERS:
        raise ValueError(f"unknown multiplier level '{level}'")

    multiplier = _MULTIPLIERS[level]
    return _append_event(
        _YieldEvent(
            action="apply_multiplier_for_ghostkey",
            payload={"wallet": wallet, "level": level, "multiplier": multiplier},
        )
    )


__all__ = [
    "activate_weekly_yield_distribution",
    "apply_multiplier_for_ghostkey",
    "install_passive_yield_engine",
    "sync_behavior_to_loyalty_chain",
    "validate_origin_rewards",
]
