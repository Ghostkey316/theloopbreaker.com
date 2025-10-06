"""Contributor protocol helpers for Vaultfire integrations."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence
from uuid import uuid4

__all__ = ["activate_contributor_pass", "ContributorPass"]

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_LOG_PATH = _REPO_ROOT / "status" / "contributor_pass_activations.jsonl"


@dataclass(frozen=True)
class ContributorPass:
    """Immutable representation of an activated contributor pass."""

    id: str
    wallet: str
    roles: tuple[str, ...]
    access_level: str
    unlocks: tuple[str, ...]
    activation_id: str
    activated_at: str
    checksum: str

    def to_payload(self, metadata: Mapping[str, Any] | None = None) -> dict[str, Any]:
        """Serialize the pass into a JSON friendly payload."""

        payload: dict[str, Any] = {
            "id": self.id,
            "wallet": self.wallet,
            "roles": list(self.roles),
            "access_level": self.access_level,
            "unlocks": list(self.unlocks),
            "activation_id": self.activation_id,
            "activated_at": self.activated_at,
            "checksum": self.checksum,
            "status": "active",
            "protocol": "vaultfire.contributor_pass",
            "version": 1,
        }
        if metadata:
            payload["metadata"] = dict(metadata)
        return payload


def _ensure_non_empty_string(value: str, field_name: str) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{field_name} must be a string")
    stripped = value.strip()
    if not stripped:
        raise ValueError(f"{field_name} must not be empty")
    return stripped


def _normalise_string_sequence(values: Sequence[str], field_name: str) -> tuple[str, ...]:
    if not isinstance(values, Sequence) or isinstance(values, (str, bytes)):
        raise TypeError(f"{field_name} must be a sequence of strings")
    normalised = []
    for index, entry in enumerate(values):
        if not isinstance(entry, str):
            raise TypeError(f"{field_name}[{index}] must be a string")
        stripped = entry.strip()
        if not stripped:
            raise ValueError(f"{field_name}[{index}] must not be empty")
        normalised.append(stripped)
    if not normalised:
        raise ValueError(f"{field_name} must contain at least one entry")
    return tuple(normalised)


def _normalise_metadata(metadata: Mapping[str, Any] | None) -> Mapping[str, Any] | None:
    if metadata is None:
        return None
    if not isinstance(metadata, Mapping):
        raise TypeError("metadata must be a mapping if provided")
    normalised = {}
    for key, value in metadata.items():
        if not isinstance(key, str):
            raise TypeError("metadata keys must be strings")
        stripped_key = key.strip()
        if not stripped_key:
            raise ValueError("metadata keys must not be empty")
        normalised[stripped_key] = value
    return normalised


def _build_checksum(data: dict[str, Any]) -> str:
    serialised = json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(serialised).hexdigest()


def activate_contributor_pass(
    *,
    id: str,
    wallet: str,
    roles: Sequence[str],
    access_level: str,
    unlocks: Sequence[str],
    metadata: Mapping[str, Any] | None = None,
    log_path: str | Path | None = None,
) -> dict[str, Any]:
    """Activate a contributor pass and persist the activation event."""

    normalised_id = _ensure_non_empty_string(id, "id")
    normalised_wallet = _ensure_non_empty_string(wallet, "wallet")
    normalised_access = _ensure_non_empty_string(access_level, "access_level")
    normalised_roles = _normalise_string_sequence(roles, "roles")
    normalised_unlocks = _normalise_string_sequence(unlocks, "unlocks")
    normalised_metadata = _normalise_metadata(metadata)

    activation_id = uuid4().hex
    activated_at = datetime.now(timezone.utc).isoformat()

    checksum_source = {
        "id": normalised_id,
        "wallet": normalised_wallet,
        "access_level": normalised_access,
        "roles": normalised_roles,
        "unlocks": normalised_unlocks,
        "activation_id": activation_id,
        "activated_at": activated_at,
    }
    checksum = _build_checksum(checksum_source)

    contributor_pass = ContributorPass(
        id=normalised_id,
        wallet=normalised_wallet,
        roles=normalised_roles,
        access_level=normalised_access,
        unlocks=normalised_unlocks,
        activation_id=activation_id,
        activated_at=activated_at,
        checksum=checksum,
    )

    payload = contributor_pass.to_payload(normalised_metadata)

    destination = Path(log_path) if log_path is not None else _DEFAULT_LOG_PATH
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, sort_keys=True) + "\n")

    return payload
