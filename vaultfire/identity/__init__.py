"""Signal anchor identity management for Vaultfire genesis events."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from types import MappingProxyType
from typing import Mapping, MutableMapping, Sequence
from uuid import uuid4

from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID
from vaultfire.identity.layer import (
    BeliefScore,
    BeliefScoreEngine,
    IdentityAnchor,
    IdentityEchoBridge,
    IdentityWeaveCore,
    PersonaMintCLI,
)

__all__ = [
    "SignalAnchorError",
    "AnchorRecord",
    "ContributionRecord",
    "MetadataRecord",
    "AuthorshipBurnRecord",
    "GenesisRegistration",
    "anchor_signal_origin",
    "timestamp_contribution_start",
    "record_originator_metadata",
    "burn_authorship_trace",
    "register_genesis_node",
    "get_signal_anchor_state",
    "reset_signal_anchor_state",
    "BroadcastReceipt",
    "GhostkeySignalBoost",
    "BeliefScore",
    "BeliefScoreEngine",
    "IdentityAnchor",
    "IdentityEchoBridge",
    "IdentityWeaveCore",
    "PersonaMintCLI",
]


class SignalAnchorError(RuntimeError):
    """Raised when the signal anchor lifecycle encounters an invalid state."""


@dataclass(slots=True)
class AnchorRecord:
    """Represents a canonical origin → wallet anchor."""

    origin_id: str
    wallet_id: str
    anchored_at: datetime

    def export(self) -> Mapping[str, object]:
        return {
            "origin_id": self.origin_id,
            "wallet_id": self.wallet_id,
            "anchored_at": self.anchored_at.isoformat(),
        }


@dataclass(slots=True)
class ContributionRecord:
    """Timestamped record for when a contribution officially began."""

    origin_id: str
    started_at: datetime

    def export(self) -> Mapping[str, object]:
        return {
            "origin_id": self.origin_id,
            "started_at": self.started_at.isoformat(),
        }


@dataclass(slots=True)
class MetadataRecord:
    """Human readable metadata about the identity establishing the anchor."""

    name: str
    wallet: str
    recorded_at: datetime

    def export(self) -> Mapping[str, object]:
        return {
            "name": self.name,
            "wallet": self.wallet,
            "recorded_at": self.recorded_at.isoformat(),
        }


@dataclass(slots=True)
class AuthorshipBurnRecord:
    """Immutable record showing when authorship traces were purged."""

    origin_id: str
    burned_at: datetime

    def export(self) -> Mapping[str, object]:
        return {
            "origin_id": self.origin_id,
            "burned_at": self.burned_at.isoformat(),
        }


@dataclass(slots=True)
class GenesisRegistration:
    """Confirms that the origin has been registered as a genesis node."""

    origin_id: str
    registered_at: datetime

    def export(self) -> Mapping[str, object]:
        return {
            "origin_id": self.origin_id,
            "registered_at": self.registered_at.isoformat(),
        }


@dataclass
class _SignalAnchorState:
    """In-memory store backing the signal anchor lifecycle."""

    anchors: MutableMapping[str, AnchorRecord] = field(default_factory=dict)
    contributions: MutableMapping[str, ContributionRecord] = field(default_factory=dict)
    metadata: MutableMapping[str, MetadataRecord] = field(default_factory=dict)
    burns: MutableMapping[str, AuthorshipBurnRecord] = field(default_factory=dict)
    genesis_nodes: MutableMapping[str, GenesisRegistration] = field(default_factory=dict)

    def snapshot(self) -> Mapping[str, object]:
        return {
            "anchors": {key: record.export() for key, record in self.anchors.items()},
            "contributions": {key: record.export() for key, record in self.contributions.items()},
            "metadata": {key: record.export() for key, record in self.metadata.items()},
            "burns": {key: record.export() for key, record in self.burns.items()},
            "genesis_nodes": {key: record.export() for key, record in self.genesis_nodes.items()},
        }

    def reset(self) -> None:
        self.anchors.clear()
        self.contributions.clear()
        self.metadata.clear()
        self.burns.clear()
        self.genesis_nodes.clear()


_STATE = _SignalAnchorState()


def _normalize_origin(origin_id: str) -> str:
    if not isinstance(origin_id, str):
        raise TypeError("origin_id must be a string")
    value = origin_id.strip()
    if not value:
        raise ValueError("origin_id must be provided")
    canonical = ORIGIN_NODE_ID.lower().replace("-", "")
    if value.lower().replace("-", "") == canonical:
        return ORIGIN_NODE_ID
    return value


def _normalize_wallet(wallet_id: str) -> str:
    if not isinstance(wallet_id, str):
        raise TypeError("wallet_id must be a string")
    value = wallet_id.strip()
    if not value:
        raise ValueError("wallet_id must be provided")
    if value.lower() == ARCHITECT_WALLET.lower():
        return ARCHITECT_WALLET
    return value


def _coerce_datetime(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if not isinstance(value, str):
        raise TypeError("timestamp must be an ISO 8601 string or datetime")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:  # pragma: no cover - defensive, but should not occur in tests
        raise ValueError("timestamp must be ISO 8601 compliant") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        parsed = parsed.astimezone(timezone.utc)
    return parsed


def anchor_signal_origin(origin_id: str, wallet_id: str) -> AnchorRecord:
    """Anchor the provided origin to a wallet, ensuring immutability on repeat calls."""

    origin = _normalize_origin(origin_id)
    wallet = _normalize_wallet(wallet_id)
    existing = _STATE.anchors.get(origin)
    if existing:
        if existing.wallet_id != wallet:
            raise SignalAnchorError(
                f"origin {origin} is already anchored to wallet {existing.wallet_id}"
            )
        return existing
    record = AnchorRecord(origin_id=origin, wallet_id=wallet, anchored_at=datetime.now(timezone.utc))
    _STATE.anchors[origin] = record
    return record


def timestamp_contribution_start(origin_id: str, timestamp: str | datetime) -> ContributionRecord:
    """Persist the official contribution start timestamp for an origin."""

    origin = _normalize_origin(origin_id)
    started_at = _coerce_datetime(timestamp)
    existing = _STATE.contributions.get(origin)
    if existing and existing.started_at != started_at:
        raise SignalAnchorError(
            f"origin {origin} already has a different contribution start timestamp registered"
        )
    record = ContributionRecord(origin_id=origin, started_at=started_at)
    _STATE.contributions[origin] = record
    return record


def record_originator_metadata(*, name: str, wallet: str) -> MetadataRecord:
    """Store human-readable metadata for the originator of the signal anchor."""

    if not isinstance(name, str) or not name.strip():
        raise ValueError("name must be provided")
    normalized_wallet = _normalize_wallet(wallet)
    record = MetadataRecord(name=name.strip(), wallet=normalized_wallet, recorded_at=datetime.now(timezone.utc))
    _STATE.metadata[normalized_wallet.lower()] = record
    return record


def burn_authorship_trace(origin_id: str) -> AuthorshipBurnRecord:
    """Record that the authorship trace for the origin has been intentionally cleared."""

    origin = _normalize_origin(origin_id)
    if origin not in _STATE.anchors:
        raise SignalAnchorError(f"origin {origin} must be anchored before authorship can be burned")
    record = AuthorshipBurnRecord(origin_id=origin, burned_at=datetime.now(timezone.utc))
    _STATE.burns[origin] = record
    return record


def register_genesis_node(origin_id: str) -> GenesisRegistration:
    """Register the origin as a genesis node once anchoring prerequisites are satisfied."""

    origin = _normalize_origin(origin_id)
    if origin not in _STATE.anchors:
        raise SignalAnchorError(f"origin {origin} must be anchored before genesis registration")
    if origin not in _STATE.contributions:
        raise SignalAnchorError(
            f"origin {origin} requires a contribution start timestamp before genesis registration"
        )
    registration = GenesisRegistration(origin_id=origin, registered_at=datetime.now(timezone.utc))
    _STATE.genesis_nodes[origin] = registration
    return registration


def get_signal_anchor_state() -> Mapping[str, object]:
    """Return a snapshot of the current signal anchor state for diagnostics and testing."""

    return _STATE.snapshot()


def reset_signal_anchor_state() -> None:
    """Clear the anchor state. Intended for use in tests only."""

    _STATE.reset()


@dataclass(frozen=True)
class BroadcastReceipt:
    """Immutable record representing a single Ghostkey broadcast event."""

    message: str
    channels: tuple[str, ...]
    broadcast_id: str
    sent_at: datetime
    metadata: Mapping[str, object]

    def export(self) -> Mapping[str, object]:
        """Return a JSON-serialisable view of the broadcast."""

        return {
            "message": self.message,
            "channels": list(self.channels),
            "broadcast_id": self.broadcast_id,
            "sent_at": self.sent_at.isoformat(),
            "metadata": dict(self.metadata),
        }


class GhostkeySignalBoost:
    """Utility for emitting verified partner-facing broadcasts."""

    _CHANNEL_ALIASES: Mapping[str, str] = {
        "twitter": "X",
        "x": "X",
        "ens": "ENS Relay",
        "ens relay": "ENS Relay",
        "partner syncmesh": "Partner SyncMesh",
        "syncmesh": "Partner SyncMesh",
    }
    _history: list[BroadcastReceipt] = []

    @classmethod
    def _normalise_channel(cls, channel: str) -> str:
        if not isinstance(channel, str):
            raise TypeError("channel names must be strings")
        cleaned = channel.strip()
        if not cleaned:
            raise ValueError("channel names must be non-empty")
        return cls._CHANNEL_ALIASES.get(cleaned.lower(), cleaned)

    @classmethod
    def send(
        cls,
        message: str,
        *,
        channels: Sequence[str],
        metadata: Mapping[str, object] | None = None,
    ) -> BroadcastReceipt:
        """Broadcast a message across the specified partner channels."""

        if not isinstance(message, str):
            raise TypeError("message must be a string")
        body = message.strip()
        if not body:
            raise ValueError("message must be provided")
        if not channels:
            raise ValueError("at least one channel must be provided")
        normalised_channels: list[str] = []
        seen: set[str] = set()
        for channel in channels:
            alias = cls._normalise_channel(channel)
            if alias not in seen:
                normalised_channels.append(alias)
                seen.add(alias)
        receipt = BroadcastReceipt(
            message=body,
            channels=tuple(normalised_channels),
            broadcast_id=str(uuid4()),
            sent_at=datetime.now(timezone.utc),
            metadata=MappingProxyType(dict(metadata or {})),
        )
        cls._history.append(receipt)
        return receipt

    @classmethod
    def history(cls) -> tuple[BroadcastReceipt, ...]:
        """Return all broadcast receipts emitted during this runtime."""

        return tuple(cls._history)

    @classmethod
    def clear_history(cls) -> None:
        """Reset the in-memory broadcast ledger (primarily for tests)."""

        cls._history.clear()
