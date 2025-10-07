"""Synchronization helpers for Vaultfire braider CLI tools."""

from __future__ import annotations

from typing import Iterable, Mapping, MutableMapping, Sequence

from ..braider import BridgeWeaver, LoopBinder, PulseEcho, Threadlinker
from ..context_matrix import BeliefAnchor, ContextNode, RecallBridge
from ..dreamweaver import Dreamweaver
from ..signal_compass import CompassRing, HesitationLens, MoralVector, SignalPulse

__all__ = ["braid_threads", "weave_recall", "echo_projection"]


def _normalize_tags(values: Iterable[str] | None) -> tuple[str, ...]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values or ():
        text = str(raw).strip()
        if not text or text in seen:
            continue
        normalized.append(text)
        seen.add(text)
    return tuple(normalized)


def _normalize_growth(values: Mapping[str, object] | None) -> Mapping[str, float]:
    growth: MutableMapping[str, float] = {}
    for key, raw_value in (values or {}).items():
        label = str(key).strip()
        if not label:
            continue
        if isinstance(raw_value, bool):
            raise TypeError("growth values must be numeric")
        growth[label] = float(raw_value)
    return dict(growth)


def braid_threads(
    statements: Sequence[str],
    *,
    span: str = "live",
    identity: str = "anonymous",
    tags: Iterable[str] | None = None,
    weight: float | int | str = 1.0,
) -> Mapping[str, object]:
    """Stitch provided statements into a belief thread bundle."""

    if not statements:
        raise ValueError("at least one statement is required")
    anchor = BeliefAnchor(f"{identity}:{span}")
    bridge = RecallBridge("TOOLS", "archive")
    linker = Threadlinker(anchor, bridge=bridge, span=span)
    context = {"identity": identity, "span": span}
    normalized_tags = _normalize_tags(tags)
    threads = [
        linker.stitch(statement, weight=weight, tags=normalized_tags, context=context)
        for statement in statements
    ]
    return {
        "identity": identity,
        "span": span,
        "threads": threads,
    }


def weave_recall(
    signal: str,
    *,
    frame: Mapping[str, object],
    identity: str = "anonymous",
    priorities: Sequence[str] | None = None,
    growth_map: Mapping[str, object] | None = None,
) -> Mapping[str, object]:
    """Weave contextual recall information for CLI tooling."""

    node = ContextNode(identity, priority=tuple(priorities or ()))
    bridge = RecallBridge("TRACE", "archive")
    weaver = BridgeWeaver(bridge, nodes=(node,))
    growth = _normalize_growth(growth_map)
    result = weaver.weave(signal=signal, frame=frame, growth_map=growth)
    return result


def echo_projection(
    *,
    identity: str = "anonymous",
    priorities: Sequence[str] | None = None,
    resonance: float = 1.0,
    anchors: Sequence[Mapping[str, object]] | None = None,
) -> Mapping[str, object]:
    """Project a resonance overlay for CLI echo tooling."""

    pulse = SignalPulse(identity=identity, input_feed="cli-tools")
    axes = tuple(priorities or ("alignment",))
    vector = MoralVector(reference_framework="cli-tools", priority=axes)
    lens = HesitationLens(trigger_threshold=0.5, retro_echo_boost=True)
    compass = CompassRing(pulse, vector, lens)
    dream = Dreamweaver(pattern="cli-loop")
    binder = LoopBinder(compass, dream)
    echo = PulseEcho(binder)
    anchor_payload = tuple(dict(anchor) for anchor in anchors or ())
    if anchor_payload:
        echo.log(anchors=anchor_payload, resonance=resonance)
    return echo.project(anchors=anchor_payload, resonance=resonance)
