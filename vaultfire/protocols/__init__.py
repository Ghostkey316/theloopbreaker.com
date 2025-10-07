"""Operational helpers for launching Vaultfire protocol pilots."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from types import MappingProxyType
from typing import Mapping, Sequence

from vaultfire.protocol.constants import MISSION_STATEMENT

__all__ = [
    "TestnetInstance",
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
