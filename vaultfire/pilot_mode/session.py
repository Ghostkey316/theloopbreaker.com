"""Pilot session management for Vaultfire."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Mapping, Optional

from .feedback import FeedbackCollector
from .keys import ProtocolKey
from .registry import PartnerRecord
from .sandbox import YieldSandbox
from . import storage

__all__ = ["PilotSession", "SessionFactory"]


@dataclass
class PilotSession:
    """Represents an active pilot mode session."""

    session_id: str
    partner_id: str
    partner_tag: str
    pilot_mode: bool
    watermark_enabled: bool
    sandbox: YieldSandbox
    feedback: FeedbackCollector
    protocol_key: ProtocolKey

    def get_watermark(self) -> Optional[str]:
        if not self.watermark_enabled:
            return None
        return "Pilot Powered by Vaultfire"

    def simulate_yield(
        self,
        *,
        wallet_id: str,
        strategy_id: str,
        sample_size: int = 100,
        telemetry_flags: Optional[Mapping[str, object]] = None,
    ):
        return self.sandbox.simulate_yield(
            partner_tag=self.partner_tag,
            session_id=self.session_id,
            wallet_id=wallet_id,
            strategy_id=strategy_id,
            sample_size=sample_size,
            telemetry_flags=telemetry_flags,
        )

    def log_behavior(
        self,
        *,
        wallet_id: str,
        event_type: str,
        payload: Mapping[str, object],
    ) -> None:
        self.sandbox.log_behavior(
            partner_tag=self.partner_tag,
            session_id=self.session_id,
            wallet_id=wallet_id,
            event_type=event_type,
            payload=payload,
        )

    def submit_feedback(
        self,
        *,
        feedback_type: str,
        message: str,
        severity: str = "info",
        metadata: Optional[Mapping[str, object]] = None,
        expose_identity: bool | None = None,
    ) -> None:
        self.feedback.submit_feedback(
            partner_tag=self.partner_tag,
            session_id=self.session_id,
            feedback_type=feedback_type,
            message=message,
            severity=severity,
            metadata=metadata,
            expose_identity=bool(expose_identity) if expose_identity is not None else False,
            partner_id=self.partner_id,
        )

    def export_context(self) -> Dict[str, object]:
        return {
            "session_id": self.session_id,
            "partner_tag": self.partner_tag,
            "pilot_mode": self.pilot_mode,
            "watermark_enabled": self.watermark_enabled,
            "protocol_key_metadata": dict(self.protocol_key.metadata),
        }


class SessionFactory:
    """Factory for initializing pilot sessions with logging."""

    def __init__(
        self,
        *,
        sandbox: Optional[YieldSandbox] = None,
        feedback: Optional[FeedbackCollector] = None,
        session_log_path=None,
    ) -> None:
        self._sandbox = sandbox or YieldSandbox()
        self._feedback = feedback or FeedbackCollector()
        self._session_log_path = session_log_path or storage.SESSION_LOG_PATH

    def _log_session(self, record: Dict[str, object]) -> None:
        storage.append_jsonl(self._session_log_path, record)

    def create(
        self,
        *,
        partner: PartnerRecord,
        protocol_key: ProtocolKey,
        watermark_override: Optional[bool] = None,
    ) -> PilotSession:
        session_id = uuid.uuid4().hex
        watermark_enabled = (
            watermark_override if watermark_override is not None else protocol_key.watermark_enabled
        )
        session = PilotSession(
            session_id=session_id,
            partner_id=partner.partner_id,
            partner_tag=partner.anonymized_tag,
            pilot_mode=True,
            watermark_enabled=watermark_enabled,
            sandbox=self._sandbox,
            feedback=self._feedback,
            protocol_key=protocol_key,
        )
        log_record: Dict[str, object] = {
            "session_id": session_id,
            "partner_tag": partner.anonymized_tag,
            "pilot_mode": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "watermark_enabled": watermark_enabled,
            "protocol_key": {
                "expires_at": protocol_key.expires_at.isoformat(),
                "usage_count": protocol_key.usage_count,
                "max_uses": protocol_key.max_uses,
            },
        }
        self._log_session(log_record)
        return session
