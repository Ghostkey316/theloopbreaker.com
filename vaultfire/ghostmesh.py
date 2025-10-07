"""GhostKey Mesh primitives for identity and intent recognition."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence

from . import ledger

__all__ = [
    "GhostNode",
    "IntentPath",
    "LoyaltyPulse",
    "SignalForker",
    "build_identity_map",
]


_GHOSTKEY_DEFAULT_HANDLES = (
    "tools:ghost",
    "tools:intent",
    "tools:pulse",
    "tools:forklog",
    "ghostkey316.eth",
)


def _timestamp() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _normalise_layer(layer: str) -> str:
    label = str(layer).strip()
    if not label:
        raise ValueError("layer must be provided for signal ingestion")
    return label


def _clone_mapping(payload: Mapping[str, Any] | None) -> Dict[str, Any]:
    if not payload:
        return {}
    return {str(key): payload[key] for key in payload}


@dataclass
class IntentPath:
    """Tracks purpose declarations, forks, and divergences."""

    node_id: str
    _timeline: List[Mapping[str, Any]] = field(default_factory=list, init=False, repr=False)
    _forks: List[Mapping[str, Any]] = field(default_factory=list, init=False, repr=False)
    _divergences: List[Mapping[str, Any]] = field(default_factory=list, init=False, repr=False)

    def declare(
        self,
        *,
        layer: str,
        intent: str,
        metadata: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        event = {
            "type": "declaration",
            "layer": _normalise_layer(layer),
            "intent": str(intent),
            "metadata": _clone_mapping(metadata),
            "recorded_at": _timestamp(),
        }
        self._timeline.append(event)
        return dict(event)

    def fork(
        self,
        *,
        layer: str,
        reason: str,
        next_intent: str,
        metadata: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        event = {
            "type": "fork",
            "layer": _normalise_layer(layer),
            "reason": str(reason),
            "next_intent": str(next_intent),
            "metadata": _clone_mapping(metadata),
            "recorded_at": _timestamp(),
        }
        self._forks.append(event)
        self._timeline.append(event)
        return dict(event)

    def diverge(
        self,
        *,
        layer: str,
        note: str,
        metadata: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        event = {
            "type": "divergence",
            "layer": _normalise_layer(layer),
            "note": str(note),
            "metadata": _clone_mapping(metadata),
            "recorded_at": _timestamp(),
        }
        self._divergences.append(event)
        self._timeline.append(event)
        return dict(event)

    def timeline(self) -> Sequence[Mapping[str, Any]]:
        return tuple(dict(event) for event in self._timeline)

    def forks(self) -> Sequence[Mapping[str, Any]]:
        return tuple(dict(event) for event in self._forks)

    def divergences(self) -> Sequence[Mapping[str, Any]]:
        return tuple(dict(event) for event in self._divergences)

    def latest(self) -> Optional[Mapping[str, Any]]:
        if not self._timeline:
            return None
        return dict(self._timeline[-1])

    def snapshot(self) -> Mapping[str, Any]:
        return {
            "node_id": self.node_id,
            "timeline": self.timeline(),
            "forks": self.forks(),
            "divergences": self.divergences(),
        }


@dataclass
class LoyaltyPulse:
    """Real-time loyalty signal emitter with score outputs."""

    node_id: str
    _trajectory: List[MutableMapping[str, Any]] = field(default_factory=list, init=False, repr=False)

    def emit(
        self,
        score: float,
        *,
        layer: str,
        context: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        normalized = max(0.0, min(1.0, float(score)))
        entry: MutableMapping[str, Any] = {
            "layer": _normalise_layer(layer),
            "score": normalized,
            "context": _clone_mapping(context),
            "recorded_at": _timestamp(),
        }
        self._trajectory.append(entry)
        return dict(entry)

    def trajectory(self) -> Sequence[Mapping[str, Any]]:
        return tuple(dict(entry) for entry in self._trajectory)

    def average(self) -> float:
        if not self._trajectory:
            return 0.0
        return sum(entry["score"] for entry in self._trajectory) / len(self._trajectory)

    def audit(self) -> Mapping[str, Any]:
        return {
            "node_id": self.node_id,
            "average": self.average(),
            "trajectory": self.trajectory(),
        }


@dataclass
class SignalForker:
    """Captures belief forks and growth moments."""

    node_id: str
    _forks: List[Mapping[str, Any]] = field(default_factory=list, init=False, repr=False)
    _growth: List[Mapping[str, Any]] = field(default_factory=list, init=False, repr=False)

    def capture(
        self,
        *,
        layer: str,
        belief: str,
        metadata: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        event = {
            "layer": _normalise_layer(layer),
            "belief": str(belief),
            "metadata": _clone_mapping(metadata),
            "recorded_at": _timestamp(),
        }
        self._forks.append(event)
        return dict(event)

    def record_growth(
        self,
        *,
        layer: str,
        descriptor: str,
        delta: float,
        metadata: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        event = {
            "layer": _normalise_layer(layer),
            "descriptor": str(descriptor),
            "delta": float(delta),
            "metadata": _clone_mapping(metadata),
            "recorded_at": _timestamp(),
        }
        self._growth.append(event)
        return dict(event)

    def snapshot(self) -> Mapping[str, Any]:
        return {
            "node_id": self.node_id,
            "forks": tuple(dict(entry) for entry in self._forks),
            "growth": tuple(dict(entry) for entry in self._growth),
        }


@dataclass
class GhostNode:
    """Behavior-aware identity anchor with persistent memory."""

    node_id: str
    handles: Iterable[str] = field(default_factory=tuple)
    intent_path: IntentPath | None = None
    loyalty_pulse: LoyaltyPulse | None = None
    signal_forker: SignalForker | None = None
    memory: List[Mapping[str, Any]] = field(default_factory=list, repr=False)

    legacy_unlocked: bool = field(default=False, init=False)
    prophecy_triggers: List[str] = field(default_factory=list, init=False, repr=False)
    _layers: List[str] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        normalized_handles = []
        for handle in self.handles or ():
            label = str(handle).strip()
            if label and label not in normalized_handles:
                normalized_handles.append(label)
        for default in _GHOSTKEY_DEFAULT_HANDLES:
            if default not in normalized_handles:
                normalized_handles.append(default)
        self.handles = tuple(normalized_handles)
        self.intent_path = self.intent_path or IntentPath(node_id=self.node_id)
        self.loyalty_pulse = self.loyalty_pulse or LoyaltyPulse(node_id=self.node_id)
        self.signal_forker = self.signal_forker or SignalForker(node_id=self.node_id)
        if any(handle.lower() == "ghostkey316.eth" for handle in self.handles):
            self.legacy_unlocked = True
            self.prophecy_triggers.append("legacy-unlock")

    def ingest_signal(
        self,
        *,
        layer: str,
        signal: Mapping[str, Any],
        intent: str | None = None,
        loyalty: float | None = None,
        fork: Mapping[str, Any] | None = None,
        divergence: str | None = None,
        growth: float | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        layer_name = _normalise_layer(layer)
        context = _clone_mapping(metadata)
        signal_payload = _clone_mapping(signal)
        record: Dict[str, Any] = {
            "layer": layer_name,
            "signal": signal_payload,
            "metadata": context,
            "received_at": _timestamp(),
        }
        if intent:
            intent_event = self.intent_path.declare(layer=layer_name, intent=intent, metadata=context)
            record["intent"] = intent_event
        if fork:
            fork_event = self.intent_path.fork(
                layer=layer_name,
                reason=str(fork.get("reason", "signal-fork")),
                next_intent=str(fork.get("next_intent", intent or "")),
                metadata=context,
            )
            self.signal_forker.capture(layer=layer_name, belief=str(fork.get("belief", fork_event["reason"])), metadata=context)
            record["fork"] = fork_event
        if divergence:
            divergence_event = self.intent_path.diverge(layer=layer_name, note=divergence, metadata=context)
            record["divergence"] = divergence_event
        if loyalty is not None:
            loyalty_event = self.loyalty_pulse.emit(loyalty, layer=layer_name, context=context)
            record["loyalty"] = loyalty_event
        if growth is not None:
            growth_event = self.signal_forker.record_growth(
                layer=layer_name,
                descriptor=signal_payload.get("descriptor", "growth"),
                delta=growth,
                metadata=context,
            )
            record["growth"] = growth_event
        self.memory.append(record)
        if layer_name not in self._layers:
            self._layers.append(layer_name)
        ledger.log_ghostkey_interaction(
            "ingest",
            node_id=self.node_id,
            layer=layer_name,
            payload={
                "intent": intent,
                "loyalty": loyalty,
                "fork": _clone_mapping(fork) if fork else {},
                "divergence": divergence,
            },
        )
        return dict(record)

    def state_sync(self) -> Mapping[str, Any]:
        return {
            "node_id": self.node_id,
            "layers": tuple(self._layers),
            "handles": self.handles,
            "memory": tuple(dict(entry) for entry in self.memory),
            "intent_path": self.intent_path.timeline(),
            "loyalty": self.loyalty_pulse.audit(),
            "forks": self.signal_forker.snapshot(),
            "legacy_unlocked": self.legacy_unlocked,
            "prophecy_triggers": tuple(self.prophecy_triggers),
        }


def build_identity_map(
    identities: Mapping[str, Iterable[str]] | None = None,
) -> Dict[str, GhostNode]:
    """Construct a live GhostKey identity map."""

    if identities is None:
        identities = {
            "Ghostkey-316": (
                "CLI",
                "Mirrorframe",
                "Braider",
                "RetroYield",
                "Ghostkey-316",
            )
        }
    mesh: Dict[str, GhostNode] = {}
    for node_id, handles in identities.items():
        mesh[node_id] = GhostNode(node_id=node_id, handles=handles)
    return mesh
