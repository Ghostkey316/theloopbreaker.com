"""Pilot broadcast layer helpers for stealth handshake activations."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from types import MappingProxyType
from typing import Mapping, MutableMapping, Sequence, Tuple

from vaultfire.identity import BroadcastReceipt, GhostkeySignalBoost

__all__ = [
    "BroadcastSignals",
    "SyncModuleStatus",
    "PilotBroadcastLayer",
    "initialize_broadcast_layer",
]


def _require_str(field: str, value: str) -> str:
    """Return ``value`` stripped, ensuring it is a non-empty string."""

    if not isinstance(value, str):
        raise TypeError(f"{field} must be provided as a string")
    trimmed = value.strip()
    if not trimmed:
        raise ValueError(f"{field} must be a non-empty string")
    return trimmed


def _normalise_unique(values: Sequence[str], *, label: str) -> Tuple[str, ...]:
    """Return a tuple of unique, order-preserving strings."""

    normalised: list[str] = []
    seen: set[str] = set()
    for value in values:
        trimmed = _require_str(label, value)
        key = trimmed.lower()
        if key in seen:
            continue
        seen.add(key)
        normalised.append(trimmed)

    if not normalised:
        raise ValueError(f"At least one {label} must be provided")

    return tuple(normalised)


def _derive_handshake(
    *,
    stage: str,
    broadcast_mode: str,
    wallet: str,
    initiator: str,
    partners: Tuple[str, ...],
    modules: Tuple[str, ...],
) -> str:
    """Generate a deterministic handshake token for the broadcast layer."""

    payload = "|".join(
        (
            stage.lower(),
            broadcast_mode.lower(),
            wallet.lower(),
            initiator.lower(),
            ",".join(partner.lower() for partner in partners),
            ",".join(module.lower() for module in modules),
        )
    )
    digest = hashlib.blake2s(payload.encode("utf-8"), digest_size=12)
    return digest.hexdigest()


@dataclass(frozen=True)
class BroadcastSignals:
    """Static references bound to a pilot broadcast."""

    public_post: str = field(metadata={"label": "public_post"})
    repo: str = field(metadata={"label": "repo"})

    def __post_init__(self) -> None:
        _require_str("public_post", self.public_post)
        _require_str("repo", self.repo)

    def export(self) -> Mapping[str, str]:
        """Return a serialisable view of the broadcast signals."""

        return {"public_post": self.public_post, "repo": self.repo}


@dataclass(frozen=True)
class SyncModuleStatus:
    """Status metadata for a synchronisation module."""

    name: str
    status: str
    details: Mapping[str, object] = field(default_factory=dict)

    def export(self) -> Mapping[str, object]:
        return {
            "name": self.name,
            "status": self.status,
            "details": dict(self.details),
        }


def _module_status(
    name: str,
    *,
    handshake: str,
    timestamp: datetime,
    stage: str,
    initiator: str,
    wallet: str,
    signals: BroadcastSignals,
) -> SyncModuleStatus:
    """Return a :class:`SyncModuleStatus` with contextual metadata."""

    normalised = name.replace("-", "").replace("_", "").lower()
    status = "pending"
    details: MutableMapping[str, object] = {
        "handshake": handshake,
        "updated_at": timestamp.isoformat(),
    }

    if normalised == "missionanchoring":
        status = "anchored"
        details.update({"stage": stage, "mission_lock": True})
    elif normalised == "telemetrycompliance":
        status = "calibrated"
        details.update({"signals": signals.export(), "compliance_window": "pilot"})
    elif normalised == "ethicsidentityloop":
        status = "verified"
        details.update({"initiator": initiator, "wallet": wallet})

    return SyncModuleStatus(
        name=name,
        status=status,
        details=MappingProxyType(dict(details)),
    )


@dataclass(frozen=True)
class PilotBroadcastLayer:
    """Composite object describing the pilot broadcast layer state."""

    stage: str
    priority: str
    broadcast_mode: str
    initiator: str
    wallet: str
    handshake_token: str
    signals: BroadcastSignals
    target_partners: Tuple[str, ...]
    sync_modules: Tuple[SyncModuleStatus, ...]
    broadcast_receipt: BroadcastReceipt
    activated_at: datetime

    def export(self) -> Mapping[str, object]:
        """Return a serialisable description of the broadcast layer."""

        return {
            "stage": self.stage,
            "priority": self.priority,
            "broadcast_mode": self.broadcast_mode,
            "initiator": self.initiator,
            "wallet": self.wallet,
            "handshake_token": self.handshake_token,
            "signals": self.signals.export(),
            "target_partners": list(self.target_partners),
            "sync_modules": [module.export() for module in self.sync_modules],
            "broadcast_receipt": self.broadcast_receipt.export(),
            "activated_at": self.activated_at.isoformat(),
        }


def initialize_broadcast_layer(
    *,
    stage: str,
    signals: Mapping[str, str],
    target_partners: Sequence[str],
    sync_modules: Sequence[str],
    priority: str,
    broadcast_mode: str,
    initiator: str,
    wallet: str,
) -> PilotBroadcastLayer:
    """Initialise the pilot broadcast layer and emit a Ghostkey broadcast."""

    stage_value = _require_str("stage", stage)
    priority_value = _require_str("priority", priority)
    mode_value = _require_str("broadcast_mode", broadcast_mode)
    initiator_value = _require_str("initiator", initiator)
    wallet_value = _require_str("wallet", wallet)

    try:
        public_post = signals["public_post"]
        repo = signals["repo"]
    except KeyError as exc:  # pragma: no cover - defensive branch
        raise KeyError(f"signals mapping missing required key: {exc.args[0]}") from exc

    broadcast_signals = BroadcastSignals(public_post=public_post, repo=repo)
    partners = _normalise_unique(target_partners, label="target partner")
    modules = _normalise_unique(sync_modules, label="sync module")

    timestamp = datetime.now(timezone.utc).replace(microsecond=0)
    handshake = _derive_handshake(
        stage=stage_value,
        broadcast_mode=mode_value,
        wallet=wallet_value,
        initiator=initiator_value,
        partners=partners,
        modules=modules,
    )

    module_statuses = tuple(
        _module_status(
            module,
            handshake=handshake,
            timestamp=timestamp,
            stage=stage_value,
            initiator=initiator_value,
            wallet=wallet_value,
            signals=broadcast_signals,
        )
        for module in modules
    )

    message = (
        f"{stage_value} | handshake={handshake} | priority={priority_value} | mode={mode_value}"
    )
    metadata: MutableMapping[str, object] = {
        "stage": stage_value,
        "initiator": initiator_value,
        "wallet": wallet_value,
        "priority": priority_value,
        "broadcast_mode": mode_value,
        "handshake": handshake,
        "signals": broadcast_signals.export(),
        "sync_modules": [module.name for module in module_statuses],
        "activated_at": timestamp.isoformat(),
    }

    receipt = GhostkeySignalBoost.send(
        message,
        channels=partners,
        metadata=metadata,
    )

    return PilotBroadcastLayer(
        stage=stage_value,
        priority=priority_value,
        broadcast_mode=mode_value,
        initiator=initiator_value,
        wallet=wallet_value,
        handshake_token=handshake,
        signals=broadcast_signals,
        target_partners=partners,
        sync_modules=module_statuses,
        broadcast_receipt=receipt,
        activated_at=timestamp,
    )

