"""Pilot session management for Vaultfire."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Iterable, Mapping, MutableMapping, Optional

from .feedback import FeedbackCollector
from .keys import ProtocolKey
from .registry import PartnerRecord
from .sandbox import YieldSandbox
from .privacy import PilotPrivacyLedger
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
    ledger: PilotPrivacyLedger
    protocols: tuple[str, ...] = ()
    real_load_enabled: bool = False
    load_multiplier: float = 1.0
    load_profile: MutableMapping[str, object] = field(default_factory=dict)

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

    def toggle_real_user_load(
        self,
        enabled: bool,
        *,
        load_multiplier: float = 1.0,
        profile: Optional[Mapping[str, object]] = None,
    ) -> None:
        self.real_load_enabled = bool(enabled)
        self.load_multiplier = max(load_multiplier, 0.1)
        self.load_profile = dict(profile or {})
        if hasattr(self.sandbox, "set_real_load_simulation"):
            self.sandbox.set_real_load_simulation(
                self.real_load_enabled,
                load_multiplier=self.load_multiplier,
                profile=self.load_profile,
            )
        self.ledger.record_reference(
            partner_tag=self.partner_tag,
            reference_type="load-toggle",
            payload={
                "session_id": self.session_id,
                "enabled": self.real_load_enabled,
                "load_multiplier": self.load_multiplier,
                "profile": dict(self.load_profile),
            },
            metadata={"protocols": list(self.protocols)},
        )

    def register_stake(
        self,
        amount: float,
        *,
        asset: str = "VF",
        metadata: Optional[Mapping[str, object]] = None,
    ) -> None:
        if amount <= 0:
            raise ValueError("amount must be positive")
        payload = {
            "session_id": self.session_id,
            "amount": amount,
            "asset": asset,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if metadata:
            payload["metadata"] = dict(metadata)
        self.ledger.record_reference(
            partner_tag=self.partner_tag,
            reference_type="stake",
            payload=payload,
            metadata={"protocols": list(self.protocols)},
        )

    def trigger_loyalty(
        self,
        trigger: str,
        *,
        score: float,
        metadata: Optional[Mapping[str, object]] = None,
    ) -> None:
        if not trigger or not trigger.strip():
            raise ValueError("trigger must be provided")
        payload = {
            "session_id": self.session_id,
            "trigger": trigger.strip(),
            "score": score,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if metadata:
            payload["metadata"] = dict(metadata)
        self.ledger.record_reference(
            partner_tag=self.partner_tag,
            reference_type="loyalty",
            payload=payload,
            metadata={"protocols": list(self.protocols)},
        )

    def mirror_consent(
        self,
        consent_reference: str,
        *,
        target_protocol: str,
        metadata: Optional[Mapping[str, object]] = None,
    ) -> None:
        if not consent_reference or not consent_reference.strip():
            raise ValueError("consent_reference must be provided")
        if not target_protocol or not target_protocol.strip():
            raise ValueError("target_protocol must be provided")
        payload = {
            "session_id": self.session_id,
            "consent_reference": consent_reference.strip(),
            "target_protocol": target_protocol.strip(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if metadata:
            payload["metadata"] = dict(metadata)
        self.ledger.record_reference(
            partner_tag=self.partner_tag,
            reference_type="consent",
            payload=payload,
            metadata={"protocols": list(self.protocols)},
        )

    def export_context(self) -> Dict[str, object]:
        return {
            "session_id": self.session_id,
            "partner_tag": self.partner_tag,
            "pilot_mode": self.pilot_mode,
            "watermark_enabled": self.watermark_enabled,
            "protocol_key_metadata": dict(self.protocol_key.metadata),
            "protocols": list(self.protocols),
            "real_load_enabled": self.real_load_enabled,
            "load_multiplier": self.load_multiplier,
            "load_profile": dict(self.load_profile),
        }


class SessionFactory:
    """Factory for initializing pilot sessions with logging."""

    def __init__(
        self,
        *,
        sandbox: Optional[YieldSandbox] = None,
        feedback: Optional[FeedbackCollector] = None,
        session_log_path=None,
        ledger: Optional[PilotPrivacyLedger] = None,
    ) -> None:
        self._ledger = ledger or PilotPrivacyLedger()
        if sandbox is None:
            self._sandbox = YieldSandbox(ledger=self._ledger)
        else:
            self._sandbox = sandbox
            if hasattr(self._sandbox, "attach_ledger"):
                self._sandbox.attach_ledger(self._ledger)
        if feedback is None:
            self._feedback = FeedbackCollector(ledger=self._ledger)
        else:
            self._feedback = feedback
            if hasattr(self._feedback, "attach_ledger"):
                self._feedback.attach_ledger(self._ledger)
        self._session_log_path = session_log_path or storage.SESSION_LOG_PATH

    def _log_session(self, record: Dict[str, object]) -> None:
        if self._ledger:
            self._ledger.record_reference(
                partner_tag=record["partner_tag"],
                reference_type="session",
                payload=record,
                metadata={
                    "watermark_enabled": record.get("watermark_enabled", False),
                    "protocols": record.get("protocols", []),
                },
            )
        else:
            storage.append_jsonl(self._session_log_path, record)

    def create(
        self,
        *,
        partner: PartnerRecord,
        protocol_key: ProtocolKey,
        watermark_override: Optional[bool] = None,
        protocols: Optional[Iterable[str]] = None,
        simulate_real_user_load: bool = False,
        load_multiplier: float = 1.0,
        load_profile: Optional[Mapping[str, object]] = None,
    ) -> PilotSession:
        session_id = uuid.uuid4().hex
        watermark_enabled = (
            watermark_override if watermark_override is not None else protocol_key.watermark_enabled
        )
        protocol_list = tuple(protocols or protocol_key.metadata.get("protocols", []))
        session = PilotSession(
            session_id=session_id,
            partner_id=partner.partner_id,
            partner_tag=partner.anonymized_tag,
            pilot_mode=True,
            watermark_enabled=watermark_enabled,
            sandbox=self._sandbox,
            feedback=self._feedback,
            protocol_key=protocol_key,
            ledger=self._ledger,
            protocols=protocol_list,
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
            "protocols": list(protocol_list),
        }
        self._log_session(log_record)
        if simulate_real_user_load or load_profile:
            session.toggle_real_user_load(
                simulate_real_user_load,
                load_multiplier=load_multiplier,
                profile=load_profile,
            )
        return session
