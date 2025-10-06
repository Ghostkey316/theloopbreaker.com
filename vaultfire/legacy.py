"""Legacy enrollment helpers for Vaultfire deployments.

This module manages the "eternal proof" registry used by legacy partners.
The :func:`initiate_eternal_proof_layer` helper validates the supplied
metadata, persists it to the ``status`` directory, and returns the canonical
record that was written.  The helpers are intentionally side-effect free
outside of the designated registry paths so tests can patch them easily.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Mapping

__all__ = [
    "LegacyMetadataError",
    "LegacyMetadataLockedError",
    "initiate_eternal_proof_layer",
]


class LegacyMetadataError(ValueError):
    """Raised when the provided legacy metadata is invalid."""


class LegacyMetadataLockedError(LegacyMetadataError):
    """Raised when attempting to modify a metadata record that is locked."""


_REGISTRY_PATH = Path("status") / "legacy_proofs.json"
_HISTORY_PATH = Path("status") / "legacy_proofs.log"


def _normalize_text(name: str, value: Any) -> str:
    if not isinstance(value, str):
        raise LegacyMetadataError(f"{name} must be a string")
    value = value.strip()
    if not value:
        raise LegacyMetadataError(f"{name} cannot be empty")
    return value


def _normalize_bool(name: str, value: Any) -> bool:
    if isinstance(value, bool):
        return value
    raise LegacyMetadataError(f"{name} must be a boolean")


def _load_registry() -> Dict[str, Dict[str, Any]]:
    if not _REGISTRY_PATH.exists():
        return {}
    try:
        with open(_REGISTRY_PATH) as stream:
            data = json.load(stream)
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(data, dict):
        return {}
    normalized: Dict[str, Dict[str, Any]] = {}
    for key, value in data.items():
        if isinstance(value, dict):
            normalized[str(key)] = dict(value)
    return normalized


def _write_registry(registry: Mapping[str, Mapping[str, Any]]) -> None:
    _REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_REGISTRY_PATH, "w") as stream:
        json.dump(registry, stream, indent=2, sort_keys=True)


def _append_history(record: Mapping[str, Any]) -> None:
    _HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_HISTORY_PATH, "a") as stream:
        stream.write(json.dumps(record, sort_keys=True) + "\n")


def initiate_eternal_proof_layer(
    *,
    identity: str,
    ENS: str,
    wallet: str,
    legacy_title: str,
    ethical_core: str,
    verified_contributor: bool,
    metadata_locked: bool,
) -> Mapping[str, Any]:
    """Register or update an identity in the eternal proof registry.

    Parameters are strictly validated to prevent accidental corruption of the
    registry.  When ``metadata_locked`` is ``True`` an existing record can no
    longer be modified and a :class:`LegacyMetadataLockedError` will be raised
    if a subsequent call attempts to update it.
    """

    record_identity = _normalize_text("identity", identity)
    payload: Dict[str, Any] = {
        "identity": record_identity,
        "ENS": _normalize_text("ENS", ENS),
        "wallet": _normalize_text("wallet", wallet),
        "legacy_title": _normalize_text("legacy_title", legacy_title),
        "ethical_core": _normalize_text("ethical_core", ethical_core),
        "verified_contributor": _normalize_bool(
            "verified_contributor", verified_contributor
        ),
        "metadata_locked": _normalize_bool("metadata_locked", metadata_locked),
    }

    registry = _load_registry()
    existing = registry.get(record_identity)
    if existing and existing.get("metadata_locked"):
        raise LegacyMetadataLockedError(
            f"Metadata for {record_identity} is locked and cannot be updated"
        )

    timestamp = datetime.now(timezone.utc).isoformat()
    if existing:
        payload["created_at"] = existing.get("created_at", timestamp)
    else:
        payload["created_at"] = timestamp
    payload["updated_at"] = timestamp

    registry[record_identity] = payload
    _write_registry(registry)
    _append_history(payload)
    return payload
