"""Vaultfire braider core for stitching memory-aware loops."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable, Mapping, MutableMapping, Sequence

from ..context_matrix import BeliefAnchor, ContextNode, RecallBridge
from ..dreamweaver import Dreamweaver
from ..signal_compass import CompassRing

__all__ = [
    "Threadlinker",
    "BridgeWeaver",
    "LoopBinder",
    "PulseEcho",
]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _timestamp() -> str:
    return _utcnow().isoformat()


def _coerce_label(value: str, *, field_name: str) -> str:
    text = str(value).strip()
    if not text:
        raise ValueError(f"{field_name} cannot be empty")
    return text


def _normalize_tags(values: Iterable[str] | None) -> tuple[str, ...]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values or ():
        label = str(raw).strip()
        if not label or label in seen:
            continue
        normalized.append(label)
        seen.add(label)
    return tuple(normalized)


def _normalize_growth(values: Mapping[str, object] | None) -> Mapping[str, float]:
    normalized: MutableMapping[str, float] = {}
    for key, raw_value in (values or {}).items():
        label = str(key).strip()
        if not label:
            continue
        if isinstance(raw_value, bool):
            raise TypeError("growth map values must be numeric")
        try:
            normalized[label] = float(raw_value)
        except (TypeError, ValueError):
            raise TypeError("growth map values must be numeric") from None
    return dict(normalized)


@dataclass(slots=True)
class Threadlinker:
    """Stitch belief anchors across spans and dispatch recall hooks."""

    anchor: BeliefAnchor
    bridge: RecallBridge | None = None
    span: str = "live"
    _threads: list[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        if not isinstance(self.anchor, BeliefAnchor):
            raise TypeError("anchor must be a BeliefAnchor instance")
        if self.bridge is not None and not isinstance(self.bridge, RecallBridge):
            raise TypeError("bridge must be a RecallBridge instance")
        self.span = _coerce_label(self.span, field_name="span")

    def stitch(
        self,
        statement: str,
        *,
        weight: float | int | str = 1.0,
        tags: Iterable[str] | None = None,
        context: Mapping[str, object] | None = None,
    ) -> Mapping[str, object]:
        """Bind a statement to the anchor and optionally dispatch recall."""

        detail = _coerce_label(statement, field_name="statement")
        entry = self.anchor.bind(detail, weight=weight, tags=tags)
        payload: MutableMapping[str, object] = {
            "span": self.span,
            "entry": dict(entry),
            "anchor": self.anchor.summary,
        }
        normalized_tags = _normalize_tags(tags)
        if normalized_tags:
            payload["tags"] = normalized_tags
        if context:
            payload["context"] = dict(context)
        if self.bridge is not None:
            recall_context = dict(context) if context else {"anchor": self.anchor.summary}
            payload["recall"] = self.bridge.dispatch(detail, context=recall_context)
        self._threads.append(copy.deepcopy(payload))
        return copy.deepcopy(payload)

    @property
    def threads(self) -> Sequence[Mapping[str, object]]:
        return tuple(copy.deepcopy(thread) for thread in self._threads)


@dataclass(slots=True)
class BridgeWeaver:
    """Weave context nodes with recall bridges for growth mapping."""

    bridge: RecallBridge
    nodes: Sequence[ContextNode]
    _history: list[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        if not isinstance(self.bridge, RecallBridge):
            raise TypeError("bridge must be a RecallBridge instance")
        snapshots: list[ContextNode] = []
        for node in self.nodes:
            if not isinstance(node, ContextNode):
                raise TypeError("nodes must be ContextNode instances")
            snapshots.append(node)
        if not snapshots:
            raise ValueError("BridgeWeaver requires at least one context node")
        self.nodes = tuple(snapshots)

    def weave(
        self,
        *,
        signal: str,
        frame: Mapping[str, object],
        growth_map: Mapping[str, object] | None = None,
    ) -> Mapping[str, object]:
        """Dispatch a recall event using the provided compass frame."""

        route = _coerce_label(signal, field_name="signal")
        context_payload: MutableMapping[str, object] = {
            "nodes": [node.snapshot for node in self.nodes],
            "frame": dict(frame),
            "growth": _normalize_growth(growth_map),
        }
        dispatched = self.bridge.dispatch(route, context=dict(context_payload))
        payload = {
            "signal": route,
            "dispatched": dict(dispatched),
            "context": dict(context_payload),
        }
        self._history.append(copy.deepcopy(payload))
        return copy.deepcopy(payload)

    @property
    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(copy.deepcopy(entry) for entry in self._history)


@dataclass(slots=True)
class LoopBinder:
    """Bind CompassRing frames with Dreamweaver overlays."""

    compass: CompassRing
    dreamweaver: Dreamweaver
    _loops: list[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        if not isinstance(self.compass, CompassRing):
            raise TypeError("compass must be a CompassRing instance")
        if not isinstance(self.dreamweaver, Dreamweaver):
            raise TypeError("dreamweaver must be a Dreamweaver instance")

    def bind(
        self,
        *,
        anchors: Sequence[Mapping[str, object]] | None = None,
        resonance: float = 1.0,
        mode: str = "overlay",
        sync: str = "live",
    ) -> Mapping[str, object]:
        """Generate an overlay bundle from the current compass frame."""

        frame = self.compass.display(mode=mode, sync=sync)
        prophecy = self.dreamweaver.project(
            compass_frame=frame,
            resonance=resonance,
            anchors=anchors or (),
        )
        bundle = {"frame": dict(frame), "prophecy": dict(prophecy)}
        self._loops.append(copy.deepcopy(bundle))
        return copy.deepcopy(bundle)

    @property
    def loops(self) -> Sequence[Mapping[str, object]]:
        return tuple(copy.deepcopy(entry) for entry in self._loops)


@dataclass(slots=True)
class PulseEcho:
    """Record pulse echoes and project future resonance."""

    binder: LoopBinder
    _echoes: list[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        if not isinstance(self.binder, LoopBinder):
            raise TypeError("binder must be a LoopBinder instance")

    def log(
        self,
        *,
        anchors: Sequence[Mapping[str, object]] | None = None,
        resonance: float = 1.0,
    ) -> Mapping[str, object]:
        """Capture the current loop bundle and store it for later projection."""

        bundle = self.binder.bind(anchors=anchors, resonance=resonance)
        payload = {
            "logged_at": _timestamp(),
            "bundle": copy.deepcopy(bundle),
        }
        self._echoes.append(copy.deepcopy(payload))
        return copy.deepcopy(payload)

    def project(
        self,
        *,
        anchors: Sequence[Mapping[str, object]] | None = None,
        resonance: float = 1.0,
    ) -> Mapping[str, object]:
        """Generate a prophecy bundle enriched with prior echoes."""

        bundle = self.binder.bind(anchors=anchors, resonance=resonance)
        bundle["echoes"] = tuple(copy.deepcopy(entry) for entry in self._echoes)
        return copy.deepcopy(bundle)

    @property
    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(copy.deepcopy(entry) for entry in self._echoes)
