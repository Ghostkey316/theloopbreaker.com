"""Dreamweaver overlays for projecting prophecy frames."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, MutableMapping, Sequence

__all__ = ["Dreamweaver"]


def _normalize_anchors(anchors: Iterable[Mapping[str, object]] | None) -> tuple[Mapping[str, object], ...]:
    normalized: list[Mapping[str, object]] = []
    for anchor in anchors or ():
        normalized.append(dict(anchor))
    return tuple(normalized)


def _normalize_projection(projection: Mapping[str, object] | None, *, resonance: float) -> MutableMapping[str, float]:
    overlay: MutableMapping[str, float] = {}
    scale = max(0.0, float(resonance))
    for axis, value in (projection or {}).items():
        try:
            overlay[str(axis)] = round(float(value) * scale, 3)
        except (TypeError, ValueError):
            continue
    return overlay


def _average_confidence(anchors: Sequence[Mapping[str, object]]) -> float:
    if not anchors:
        return 0.0
    confidence_values: list[float] = []
    for anchor in anchors:
        value = anchor.get("confidence")
        if isinstance(value, bool):
            raise TypeError("anchor confidence must be numeric")
        if value is None:
            continue
        try:
            confidence_values.append(float(value))
        except (TypeError, ValueError):
            continue
    if not confidence_values:
        return 0.0
    return sum(confidence_values) / len(confidence_values)


@dataclass(slots=True)
class Dreamweaver:
    """Project CompassRing frames into prophecy overlays."""

    pattern: str = "compass-weave"

    def project(
        self,
        *,
        compass_frame: Mapping[str, object],
        resonance: float,
        anchors: Sequence[Mapping[str, object]] | None = None,
    ) -> Mapping[str, object]:
        """Project a compass frame into an overlay representation."""

        normalized_anchors = _normalize_anchors(anchors)
        overlay = _normalize_projection(
            compass_frame.get("projection"), resonance=float(resonance)
        )
        anchor_avg = _average_confidence(normalized_anchors)
        base_resonance = max(0.0, float(resonance))
        resonance_score = min(1.0, base_resonance + (anchor_avg / 2.0))
        payload: MutableMapping[str, object] = {
            "pattern": self.pattern,
            "source": compass_frame.get("framework"),
            "overlay": dict(overlay),
            "resonance": round(resonance_score, 3),
            "anchors": len(normalized_anchors),
        }
        if normalized_anchors:
            payload["anchor_confidence"] = round(anchor_avg, 3)
        return payload
