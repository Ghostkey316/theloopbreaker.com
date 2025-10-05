"""Minimal MCP signal responder for the GhostkeyVaultfireAgent widget."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Dict, Mapping, MutableMapping, Optional

from vaultfire.pilot_mode import PilotPrivacyLedger, PilotResonanceTelemetry, PilotSession

__all__ = ["MCPResponse", "MissionSignalResponder"]


@dataclass(frozen=True)
class MCPResponse:
    """Return type used for MCP signal acknowledgements."""

    signal_type: str
    payload: Mapping[str, object]
    reference_id: Optional[str] = None

    def export(self) -> Dict[str, object]:
        data = {"signal_type": self.signal_type, "payload": dict(self.payload)}
        if self.reference_id:
            data["reference_id"] = self.reference_id
        return data


class MissionSignalResponder:
    """Route Mission Control Protocol (MCP) signals to registered handlers."""

    def __init__(
        self,
        *,
        ledger: PilotPrivacyLedger,
        telemetry: PilotResonanceTelemetry,
    ) -> None:
        self._ledger = ledger
        self._telemetry = telemetry
        self._handlers: MutableMapping[str, Callable[[PilotSession, Mapping[str, object]], Mapping[str, object]]] = {}

    def register_handler(
        self,
        signal_type: str,
        handler: Callable[[PilotSession, Mapping[str, object]], Mapping[str, object]],
    ) -> None:
        """Register a custom handler for the provided signal type."""

        if not signal_type:
            raise ValueError("signal_type must be provided")
        self._handlers[signal_type] = handler

    def handle_signal(
        self,
        session: PilotSession,
        signal: Mapping[str, object],
    ) -> MCPResponse:
        """Handle an MCP signal and log the response to the ledger."""

        signal_type = str(signal.get("type", "mission-digest"))
        handler = self._handlers.get(signal_type, self._default_handler)
        payload = handler(session, signal)
        response_payload = {
            "session_id": session.session_id,
            "partner_tag": session.partner_tag,
            "signal": signal_type,
            "response": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        reference = self._ledger.record_reference(
            partner_tag=session.partner_tag,
            reference_type="mcp-signal",
            payload=response_payload,
            metadata={"signal_type": signal_type, "stealth": session.pilot_mode},
        )
        return MCPResponse(signal_type=signal_type, payload=payload, reference_id=reference.reference_id)

    # ------------------------------------------------------------------
    # Default handler
    # ------------------------------------------------------------------
    def _default_handler(self, session: PilotSession, signal: Mapping[str, object]) -> Mapping[str, object]:
        """Produce a mission digest using the current resonance telemetry."""

        if session.resonance is None:
            session.resonance = self._telemetry
        digest = session.resonance_digest()
        return {
            "mission": signal.get("mission", "Ghostkey Vaultfire"),
            "resonance": digest,
            "protocols": list(session.protocols),
            "stealth": session.pilot_mode,
        }
