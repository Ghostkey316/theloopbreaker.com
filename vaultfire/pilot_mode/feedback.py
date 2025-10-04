"""Feedback collection for pilot users."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Mapping, MutableMapping, Optional

from . import storage

__all__ = ["FeedbackRecord", "FeedbackCollector"]


@dataclass
class FeedbackRecord:
    """Structured pilot feedback payload."""

    partner_tag: str
    session_id: str
    feedback_type: str
    message: str
    severity: str
    created_at: datetime
    metadata: MutableMapping[str, object]
    expose_identity: bool
    partner_id: Optional[str] = None

    def export(self) -> Dict[str, object]:
        payload = {
            "partner_tag": self.partner_tag,
            "session_id": self.session_id,
            "feedback_type": self.feedback_type,
            "message": self.message,
            "severity": self.severity,
            "created_at": self.created_at.isoformat(),
            "metadata": dict(self.metadata),
            "expose_identity": self.expose_identity,
        }
        if self.partner_id and self.expose_identity:
            payload["partner_id"] = self.partner_id
        return payload


class FeedbackCollector:
    """Capture and persist structured pilot feedback."""

    def __init__(self, *, log_path=None) -> None:
        self._log_path = log_path or storage.FEEDBACK_LOG_PATH

    def submit_feedback(
        self,
        *,
        partner_tag: str,
        session_id: str,
        feedback_type: str,
        message: str,
        severity: str = "info",
        metadata: Optional[Mapping[str, object]] = None,
        expose_identity: bool = False,
        partner_id: Optional[str] = None,
    ) -> FeedbackRecord:
        if not feedback_type or not feedback_type.strip():
            raise ValueError("feedback_type must be provided")
        if not message or not message.strip():
            raise ValueError("message must be provided")
        record = FeedbackRecord(
            partner_tag=partner_tag,
            session_id=session_id,
            feedback_type=feedback_type.strip(),
            message=message.strip(),
            severity=severity,
            created_at=datetime.now(timezone.utc),
            metadata=dict(metadata or {}),
            expose_identity=expose_identity,
            partner_id=partner_id,
        )
        storage.append_jsonl(self._log_path, record.export())
        return record

    def format_cli_payload(
        self,
        *,
        feedback_type: str,
        message: str,
        severity: str = "info",
        metadata: Optional[Mapping[str, object]] = None,
    ) -> Dict[str, object]:
        return {
            "feedback_type": feedback_type,
            "message": message,
            "severity": severity,
            "metadata": dict(metadata or {}),
        }
