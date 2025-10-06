"""Convenience utilities for streaming telemetry into Agent Builder widgets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from vaultfire.pilot_mode.session import PilotSession
from vaultfire.pilot_mode.stealth_telemetry import StealthTelemetryBundle
from vaultfire_widget_bundle.telemetry.gradient_stream import GradientStreamPacket

__all__ = ["StreamLoader", "build_streamer"]


@dataclass
class StreamLoader:
    """Adapter that exposes gradient packets for a pilot session."""

    telemetry: StealthTelemetryBundle

    def packets(
        self,
        session: PilotSession,
        *,
        include_belief_loop_graph: bool = True,
        include_session_state: bool = True,
    ) -> Iterable[GradientStreamPacket]:
        return self.telemetry.iter_packets(
            session,
            include_belief_loop_graph=include_belief_loop_graph,
            include_session_state=include_session_state,
        )


def build_streamer(
    telemetry: StealthTelemetryBundle,
    session: PilotSession,
    *,
    include_belief_loop_graph: bool = True,
    include_session_state: bool = True,
) -> Iterable[GradientStreamPacket]:
    """Return an iterator of telemetry packets for ``session``."""

    loader = StreamLoader(telemetry=telemetry)
    return loader.packets(
        session,
        include_belief_loop_graph=include_belief_loop_graph,
        include_session_state=include_session_state,
    )

