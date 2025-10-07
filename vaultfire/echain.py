"""Echochain integration primitives for Vaultfire."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Iterable, List, MutableSequence, Optional, Sequence, Set


@dataclass
class EchoEmitter:
    """Collects echo payloads and produces a consumable stream."""

    _stream: List[Dict[str, object]] = field(default_factory=list)
    _sequence: int = 0

    def emit(self, payload: Dict[str, object]) -> Dict[str, object]:
        """Append ``payload`` to the stream with metadata and return entry."""

        self._sequence += 1
        entry = {
            "id": self._sequence,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self._stream.append(entry)
        return entry

    def stream(self) -> MutableSequence[Dict[str, object]]:
        """Expose a mutable view over the underlying stream."""

        return self._stream


class EchochainCore:
    """High-level controller for configuring an echo memory engine."""

    def __init__(
        self,
        *,
        memory_mode: str,
        compression: str,
        emitter: Optional[EchoEmitter] = None,
    ) -> None:
        self.memory_mode = memory_mode
        self.compression = compression
        self._emitter = emitter or EchoEmitter()
        self._tracked_events: Set[str] = set()
        self.identity: Dict[str, Optional[str]] = {}
        self.status = "BOOT"
        self._last_beacon: Optional[Dict[str, object]] = None

    def bind_identity(self, *, wallet: str, ens: Optional[str], persona: Optional[str]) -> Dict[str, Optional[str]]:
        """Bind a wallet/ENS/persona tuple to this echo instance."""

        self.identity = {
            "wallet": wallet,
            "ens": ens,
            "persona": persona,
        }
        payload = {
            "type": "identity_bound",
            "identity": dict(self.identity),
        }
        self._emitter.emit(payload)
        return dict(self.identity)

    def track(self, *, events: Sequence[str]) -> List[str]:
        """Register event types that should be echoed."""

        for event in events:
            if not event:
                continue
            self._tracked_events.add(str(event))
        payload = {
            "type": "tracking_update",
            "events": sorted(self._tracked_events),
        }
        self._emitter.emit(payload)
        return sorted(self._tracked_events)

    def output_stream(self) -> MutableSequence[Dict[str, object]]:
        """Return a mutable sequence representing the echo output stream."""

        return self._emitter.stream()

    def emit_beacon(self, *, signal: str, lifetime: str) -> Dict[str, object]:
        """Emit a beacon event and mark the engine as live."""

        payload = {
            "type": "beacon",
            "signal": signal,
            "lifetime": lifetime,
            "identity": dict(self.identity),
            "memory_mode": self.memory_mode,
            "compression": self.compression,
            "tracked_events": sorted(self._tracked_events),
        }
        entry = self._emitter.emit(payload)
        self._last_beacon = entry
        self.status = "LIVE"
        return entry

    @property
    def last_beacon(self) -> Optional[Dict[str, object]]:
        """Return the latest beacon emitted by the engine, if any."""

        return self._last_beacon


class RetroDropEngine:
    """Registry for feeds eligible for retroactive drops."""

    _feeds: List[MutableSequence[Dict[str, object]]] = []

    @classmethod
    def register_echo_feed(cls, feed: MutableSequence[Dict[str, object]]) -> None:
        """Register a feed so the engine can evaluate it in future drops."""

        if feed not in cls._feeds:
            cls._feeds.append(feed)

    @classmethod
    def feeds(cls) -> Iterable[MutableSequence[Dict[str, object]]]:
        """Return an iterable snapshot of the registered feeds."""

        return tuple(cls._feeds)


__all__ = ["EchochainCore", "EchoEmitter", "RetroDropEngine"]
