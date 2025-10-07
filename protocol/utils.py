"""Helper utilities supporting Vaultfire trial activation flows."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Tuple

from .identity import IdentityRecord

__all__ = [
    "TraceHook",
    "trace_logger",
    "guardian_attestation",
    "forge_lock",
    "verify_immutability",
    "governance_summary",
]


@dataclass(frozen=True)
class TraceHook:
    """Metadata describing a trace hook used during activation."""

    name: str
    channels: Tuple[str, ...]
    description: str = ""
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def supports(self, channel: str) -> bool:
        """Return whether the hook publishes events to the requested channel."""

        return channel in self.channels

    def summary(self) -> Dict[str, Any]:
        """Serialize the hook metadata for logging."""

        return {
            "name": self.name,
            "channels": list(self.channels),
            "description": self.description,
            "metadata": dict(self.metadata),
        }


class _TraceLogger:
    """Factory for telemetry trace hooks."""

    def capture_all(self) -> TraceHook:
        return TraceHook(
            name="trace_logger",
            channels=("telemetry", "signal"),
            description="Capture Vaultfire telemetry and signal traces during Golden Trial mode.",
            metadata={"retention": "24h", "scope": "golden_trial"},
        )


trace_logger = _TraceLogger()


class _GuardianAttestation:
    """Factory for guardian attestation hooks."""

    def observe(self) -> TraceHook:
        return TraceHook(
            name="guardian_attestation",
            channels=("signal", "guardian"),
            description="Stream guardian attestations alongside live signal telemetry.",
            metadata={"sensitivity": "high"},
        )


guardian_attestation = _GuardianAttestation()


_LOCKED_FORGES: set[str] = set()


def _extract_identity_address(identity: IdentityRecord | str) -> str:
    if isinstance(identity, IdentityRecord):
        return identity.address
    if not isinstance(identity, str):
        raise TypeError("identity must be an IdentityRecord or string address")
    return identity


def forge_lock(*, identity: IdentityRecord | str) -> bool:
    """Lock the ForgeTrail layer for the provided identity."""

    address = _extract_identity_address(identity).strip()
    if not address:
        raise ValueError("identity must include a non-empty address")
    _LOCKED_FORGES.add(address)
    return True


def verify_immutability(identity: IdentityRecord) -> bool:
    """Validate that the identity metadata fingerprint is intact."""

    if not isinstance(identity, IdentityRecord):
        raise TypeError("verify_immutability expects an IdentityRecord instance")
    return identity.verify_immutability()


@dataclass(frozen=True)
class GovernanceSnapshot:
    """Summary of the governance status for a Vaultfire identity."""

    status: str
    updated_at: str
    proposals: Tuple[str, ...]
    participants: Tuple[str, ...]

    def as_dict(self) -> Dict[str, Any]:  # pragma: no cover - convenience wrapper
        return {
            "status": self.status,
            "updated_at": self.updated_at,
            "proposals": list(self.proposals),
            "participants": list(self.participants),
        }


_GOVERNANCE_PROPOSALS = (
    "guardian-signal-alignment",
    "telemetry-yield-stabilizer",
    "golden-trial-handoff",
)


def governance_summary(identity: IdentityRecord) -> GovernanceSnapshot:
    """Return a governance snapshot anchored to the provided identity."""

    if not isinstance(identity, IdentityRecord):
        raise TypeError("governance_summary expects an IdentityRecord instance")

    timestamp = (
        datetime.now(tz=timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )

    participants: Tuple[str, ...] = (
        identity.address,
        *(tag for tag in identity.tags),
    )

    return GovernanceSnapshot(
        status="synced",
        updated_at=timestamp,
        proposals=_GOVERNANCE_PROPOSALS,
        participants=participants,
    )

