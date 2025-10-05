"""Mission Control hook utilities for the GhostkeyVaultfireAgent widget."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Mapping, Optional

from vaultfire.enterprise.mission_control import EnterpriseMissionControl
from vaultfire.pilot_mode import MissionControlPoints, PilotPrivacyLedger, PilotResonanceTelemetry, PilotSession

from .gradient_stream import GradientStreamPacket

__all__ = ["StealthActivationPayload", "MissionControlHooks"]


@dataclass(frozen=True)
class StealthActivationPayload:
    """Serialized result when a stealth pilot session is toggled."""

    session_id: str
    partner_tag: str
    options: Mapping[str, object]
    mission_reference: Mapping[str, object]

    def export(self) -> Dict[str, object]:
        return {
            "session_id": self.session_id,
            "partner_tag": self.partner_tag,
            "options": dict(self.options),
            "mission_reference": dict(self.mission_reference),
        }


class MissionControlHooks:
    """High-level helpers that bind telemetry, ledger, and mission control."""

    def __init__(
        self,
        *,
        ledger: PilotPrivacyLedger,
        telemetry: PilotResonanceTelemetry,
        mission_control: Optional[EnterpriseMissionControl] = None,
    ) -> None:
        self._ledger = ledger
        self._telemetry = telemetry
        self._mission_control = mission_control or EnterpriseMissionControl()
        self._points = MissionControlPoints(ledger=self._ledger, telemetry=self._telemetry)

    def _attach_telemetry(self, session: PilotSession) -> None:
        if session.resonance is None:
            session.resonance = self._telemetry

    def on_session_launch(
        self,
        session: PilotSession,
        *,
        partner_profile: Optional[Mapping[str, object]] = None,
    ) -> Dict[str, object]:
        """Record a launch event with an optional mission anchor payload."""

        self._attach_telemetry(session)
        anchor_payload = None
        if partner_profile:
            anchor_payload = self._mission_control.register_mission_anchor(dict(partner_profile))
        resonance = session.resonance_digest()
        reference = self._ledger.record_reference(
            partner_tag=session.partner_tag,
            reference_type="mission-launch",
            payload={
                "session_id": session.session_id,
                "anchor": anchor_payload,
                "resonance": resonance,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            metadata={"protocols": list(session.protocols), "pilot_mode": session.pilot_mode},
        )
        return {
            "reference_id": reference.reference_id,
            "anchor": anchor_payload,
            "resonance": resonance,
        }

    def on_stealth_activation(
        self,
        session: PilotSession,
        *,
        allow_confidential_sessions: bool,
        auto_expire_on_signal_mismatch: bool,
        metadata: Optional[Mapping[str, object]] = None,
    ) -> StealthActivationPayload:
        """Persist a stealth activation record and return the structured payload."""

        self._attach_telemetry(session)
        mission_reference = self._points.log_resonance(
            partner_tag=session.partner_tag,
            session_id=session.session_id,
        )
        payload = StealthActivationPayload(
            session_id=session.session_id,
            partner_tag=session.partner_tag,
            options={
                "allow_confidential_sessions": allow_confidential_sessions,
                "auto_expire_on_signal_mismatch": auto_expire_on_signal_mismatch,
                "metadata": dict(metadata or {}),
            },
            mission_reference=mission_reference,
        )
        self._ledger.record_reference(
            partner_tag=session.partner_tag,
            reference_type="stealth-activation",
            payload=payload.export(),
            metadata={
                "pilot_mode": session.pilot_mode,
                "protocols": list(session.protocols),
                "stealth": True,
            },
        )
        return payload

    def on_gradient_packet(
        self,
        session: PilotSession,
        packet: GradientStreamPacket,
        *,
        store_payload: bool = False,
    ) -> Dict[str, object]:
        """Relay gradient packets into the mission ledger for observability."""

        self._attach_telemetry(session)
        metadata = {
            "channel": packet.channel,
            "stealth": session.pilot_mode,
            "store_payload": store_payload,
        }
        payload = {"timestamp": packet.timestamp}
        if store_payload:
            payload["payload"] = dict(packet.payload)
        reference = self._ledger.record_reference(
            partner_tag=session.partner_tag,
            reference_type="gradient-stream",
            payload={
                "session_id": session.session_id,
                "channel": packet.channel,
                "timestamp": packet.timestamp,
                "stealth_mode": session.pilot_mode,
                "payload": dict(packet.payload) if store_payload else {"keys": list(packet.payload.keys())},
            },
            metadata=metadata,
        )
        return {"reference_id": reference.reference_id, "metadata": metadata}
