"""Stealth telemetry helpers tailored for Ghostkey Vaultfire Agent Builder flows."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Optional

from .access_layer import PilotAccessLayer
from .feedback import FeedbackCollector
from .keys import ProtocolKeyManager
from .privacy import PilotPrivacyLedger
from .registry import PilotAccessRegistry
from .resonance import PilotResonanceTelemetry
from .sandbox import YieldSandbox
from .session import PilotSession
from vaultfire_widget_bundle.telemetry.gradient_stream import GradientStreamer, GradientStreamPacket

__all__ = ["StealthTelemetryBundle", "gradient_stream"]


@dataclass
class StealthTelemetryBundle:
    """Container describing the configured telemetry stack."""

    mode: str
    access_layer: PilotAccessLayer
    gradient_window_seconds: float
    accepted_enclaves: Mapping[str, str]

    def stream(
        self,
        session: PilotSession,
        *,
        include_belief_loop_graph: bool = True,
        include_session_state: bool = True,
    ) -> GradientStreamer:
        """Return a :class:`GradientStreamer` for ``session``."""

        return GradientStreamer(
            telemetry=self.access_layer.resonance,
            session=session,
            include_belief_loop_graph=include_belief_loop_graph,
            include_session_state=include_session_state,
        )

    def iter_packets(
        self,
        session: PilotSession,
        *,
        include_belief_loop_graph: bool = True,
        include_session_state: bool = True,
    ) -> Iterable[GradientStreamPacket]:
        """Yield gradient packets for ``session``."""

        streamer = self.stream(
            session,
            include_belief_loop_graph=include_belief_loop_graph,
            include_session_state=include_session_state,
        )
        return streamer.iter_packets()


def _path_or_none(base_path: Optional[Path], filename: str) -> Optional[Path]:
    if base_path is None:
        return None
    return base_path / filename


def gradient_stream(
    *,
    mode: str = "pilot",
    base_path: Optional[Path] = None,
    accepted_enclaves: Optional[Mapping[str, str]] = None,
) -> StealthTelemetryBundle:
    """Build a stealth telemetry bundle for Agent Builder usage."""

    gradient_window = 600.0 if mode == "pilot" else 420.0
    base_dir = Path(base_path) if base_path is not None else None
    ledger = PilotPrivacyLedger(reference_log_path=_path_or_none(base_dir, "ledger.jsonl"))
    registry = PilotAccessRegistry(path=_path_or_none(base_dir, "partners.json"))
    key_manager = ProtocolKeyManager(path=_path_or_none(base_dir, "protocol_keys.json"))
    sandbox = YieldSandbox(
        yield_log_path=_path_or_none(base_dir, "yield.jsonl"),
        behavior_log_path=_path_or_none(base_dir, "behavior.jsonl"),
        ledger=ledger,
    )
    feedback = FeedbackCollector(log_path=_path_or_none(base_dir, "feedback.jsonl"), ledger=ledger)
    resonance = PilotResonanceTelemetry(
        ledger=ledger,
        accepted_measurements=accepted_enclaves,
        gradient_window_seconds=gradient_window,
    )
    access_layer = PilotAccessLayer(
        registry=registry,
        key_manager=key_manager,
        sandbox=sandbox,
        feedback=feedback,
        ledger=ledger,
        resonance=resonance,
    )
    return StealthTelemetryBundle(
        mode=mode,
        access_layer=access_layer,
        gradient_window_seconds=gradient_window,
        accepted_enclaves=dict(accepted_enclaves or {}),
    )

