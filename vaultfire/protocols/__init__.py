"""Operational helpers for launching Vaultfire protocol pilots."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from secrets import token_hex
from types import MappingProxyType
from typing import Any, Iterable, Mapping, Sequence

from vaultfire.protocol.constants import MISSION_STATEMENT

__all__ = [
    "TestnetInstance",
    "activate_contributor_pass",
    "get_active_testnets",
    "launch_testnet_instance",
]


@dataclass(frozen=True)
class TestnetInstance:
    """Representation of a launched partner testnet."""

    __test__ = False

    partner: str
    scope: str
    status: str
    endpoints: Mapping[str, str]
    features: tuple[str, ...]
    mission_statement: str
    created_at: datetime

    def export(self) -> Mapping[str, object]:
        """Return a serialisable snapshot of the instance."""

        return {
            "partner": self.partner,
            "scope": self.scope,
            "status": self.status,
            "endpoints": dict(self.endpoints),
            "features": list(self.features),
            "mission_statement": self.mission_statement,
            "created_at": self.created_at.isoformat(),
        }


_DEFAULT_FEATURES: tuple[str, ...] = (
    "encrypted_telemetry",
    "fhe_stack",
    "passive_yield_logic",
)

_INSTANCES: dict[str, TestnetInstance] = {}


def _normalise_partner(partner: str) -> str:
    if not isinstance(partner, str):
        raise TypeError("partner must be a string")
    value = partner.strip().lower()
    if not value:
        raise ValueError("partner must be provided")
    return value


def _slugify_partner(partner: str) -> str:
    return _normalise_partner(partner).replace("_", "-").replace(".", "-")


def launch_testnet_instance(
    partner: str,
    *,
    scope: str = "pilot",
    features: Sequence[str] | None = None,
) -> TestnetInstance:
    """Launch (or return) a scoped testnet instance for the partner."""

    normalised_partner = _normalise_partner(partner)
    if normalised_partner in _INSTANCES:
        return _INSTANCES[normalised_partner]
    slug = _slugify_partner(normalised_partner)
    applied_features = tuple(dict.fromkeys(features or _DEFAULT_FEATURES))
    endpoints = MappingProxyType(
        {
            "api": f"https://{slug}.vaultfire.testnet/api",
            "telemetry": f"wss://{slug}.vaultfire.testnet/telemetry",
            "dashboard": f"https://{slug}.vaultfire.testnet/dashboard",
        }
    )
    instance = TestnetInstance(
        partner=normalised_partner,
        scope=scope.strip() or "pilot",
        status="active",
        endpoints=endpoints,
        features=applied_features,
        mission_statement=MISSION_STATEMENT,
        created_at=datetime.now(timezone.utc),
    )
    _INSTANCES[normalised_partner] = instance
    return instance


def get_active_testnets() -> tuple[TestnetInstance, ...]:
    """Return all active testnet instances for diagnostics."""

    return tuple(_INSTANCES.values())


def _ensure_text(name: str, value: Any) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{name} must be a string")
    trimmed = value.strip()
    if not trimmed:
        raise ValueError(f"{name} cannot be empty")
    return trimmed


def _ensure_iterable(name: str, value: Any) -> Iterable[Any]:
    if isinstance(value, (str, bytes)):
        raise TypeError(f"{name} must be a sequence of values")
    if not isinstance(value, Iterable):
        raise TypeError(f"{name} must be iterable")
    return value


def _normalise_sequence(name: str, values: Any) -> list[str]:
    result: list[str] = []
    for raw in _ensure_iterable(name, values):
        text = _ensure_text(name, raw)
        if text not in result:
            result.append(text)
    if not result:
        raise ValueError(f"{name} must contain at least one value")
    return result


def _serialise_for_checksum(payload: Mapping[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def _write_log(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, sort_keys=True) + "\n")


def activate_contributor_pass(
    *,
    id: str,
    wallet: str,
    roles: Sequence[str],
    access_level: str,
    unlocks: Sequence[str],
    log_path: str | Path,
) -> dict[str, Any]:
    """Activate a contributor pass and persist an immutable audit log.

    The helper normalises contributor metadata, assigns a deterministic
    activation identifier, and records the activation in JSON Lines format
    so compliance tooling can stream contributor state changes without
    coupling to bespoke data stores.
    """

    contributor_id = _ensure_text("id", id)
    contributor_wallet = _ensure_text("wallet", wallet)
    contributor_access = _ensure_text("access_level", access_level)
    contributor_roles = _normalise_sequence("roles", roles)
    contributor_unlocks = _normalise_sequence("unlocks", unlocks)

    activated_at = datetime.now(timezone.utc).isoformat()
    activation_id = token_hex(16)

    checksum_source = {
        "id": contributor_id,
        "wallet": contributor_wallet,
        "access_level": contributor_access,
        "roles": tuple(contributor_roles),
        "unlocks": tuple(contributor_unlocks),
        "activation_id": activation_id,
        "activated_at": activated_at,
    }
    checksum = sha256(_serialise_for_checksum(checksum_source).encode("utf-8")).hexdigest()

    payload: dict[str, Any] = {
        "id": contributor_id,
        "wallet": contributor_wallet,
        "roles": contributor_roles,
        "unlocks": contributor_unlocks,
        "access_level": contributor_access,
        "status": "active",
        "protocol": "vaultfire.contributor_pass",
        "version": 1,
        "activation_id": activation_id,
        "activated_at": activated_at,
        "checksum": checksum,
        "neuro_symbolic_stack": [
            "temporal_resonance_guard",
            "zero_knowledge_circuit_breaker",
            "HorizonSignalLoom",
            "consent_token_exchange",
            "biofeedback_alignment_loops",
            "edge_trust_pods",
        ],
    }

    _write_log(Path(log_path), payload)
    return payload
