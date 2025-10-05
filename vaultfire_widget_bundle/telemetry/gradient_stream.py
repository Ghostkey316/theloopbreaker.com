"""Streaming utilities for gradient telemetry within Agent Builder widgets."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, Iterator, Mapping, MutableMapping

from vaultfire.pilot_mode import PilotResonanceTelemetry, PilotSession

__all__ = ["GradientStreamPacket", "GradientStreamer"]


@dataclass(frozen=True)
class GradientStreamPacket:
    """Serializable telemetry packet consumed by Agent Builder widgets."""

    channel: str
    timestamp: str
    payload: Mapping[str, object]

    def as_dict(self) -> Mapping[str, object]:
        """Return the packet as a plain mapping."""

        return {"channel": self.channel, "timestamp": self.timestamp, "payload": dict(self.payload)}


class GradientStreamer:
    """Render resonance gradients and pilot state snapshots as a stream."""

    def __init__(
        self,
        *,
        telemetry: PilotResonanceTelemetry,
        session: PilotSession,
        include_belief_loop_graph: bool = True,
        include_session_state: bool = True,
    ) -> None:
        if session.resonance is None:
            session.resonance = telemetry
        self._telemetry = telemetry
        self._session = session
        self._include_graph = include_belief_loop_graph
        self._include_state = include_session_state

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _base_digest(self) -> Mapping[str, object]:
        digest = self._telemetry.integrity_digest()
        default_digest: MutableMapping[str, object] = {
            "gradient_window_seconds": digest.get("gradient_window_seconds", 600),
            "resonance_gradient": digest.get("resonance_gradient", 0.0),
            "resonance_index": digest.get("resonance_index", 0.0),
            "meets_threshold": digest.get("meets_threshold", False),
            "signal_count": digest.get("signal_count", 0),
        }
        breakdown = digest.get("technique_breakdown")
        if isinstance(breakdown, Mapping):
            default_digest["technique_breakdown"] = dict(breakdown)
        return default_digest

    def _belief_loop_points(self, digest: Mapping[str, object]) -> Iterable[Mapping[str, float]]:
        gradient = digest.get("resonance_gradient", 0.0)
        if isinstance(gradient, Mapping):
            return [
                {"index": int(idx), "value": float(value)}
                for idx, value in gradient.items()
                if isinstance(idx, (int, str))
            ]
        if isinstance(gradient, (list, tuple)):
            return [
                {"index": idx, "value": float(value)}
                for idx, value in enumerate(gradient)
            ]
        gradient_value = float(gradient)
        return [
            {"index": -1, "value": round(gradient_value * 0.85, 6)},
            {"index": 0, "value": round(gradient_value, 6)},
            {"index": 1, "value": round(gradient_value * 1.05, 6)},
        ]

    def iter_packets(self) -> Iterator[GradientStreamPacket]:
        """Yield telemetry packets for Agent Builder consumption."""

        digest = self._base_digest()
        yield GradientStreamPacket(
            channel="gradient",
            timestamp=self._timestamp(),
            payload=digest,
        )

        if self._include_graph:
            payload = {
                "points": list(self._belief_loop_points(digest)),
                "label": "Belief Loop Resonance",
            }
            yield GradientStreamPacket(
                channel="belief-loop",
                timestamp=self._timestamp(),
                payload=payload,
            )

        if self._include_state:
            state_payload: Dict[str, object] = self._session.export_context()
            state_payload["stealth_mode"] = bool(self._session.pilot_mode)
            yield GradientStreamPacket(
                channel="pilot-state",
                timestamp=self._timestamp(),
                payload=state_payload,
            )

    def stream(self) -> Iterable[GradientStreamPacket]:
        """Alias for :meth:`iter_packets` used by some widget runtimes."""

        return self.iter_packets()
