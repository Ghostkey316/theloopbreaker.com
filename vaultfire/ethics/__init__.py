"""Human-AI ethics enforcement utilities for Vaultfire deployments."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping, MutableSequence, Sequence

__all__ = ["BehavioralEthicsMonitor", "ConsentFirstMirror"]


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


@dataclass
class _EthicEvent:
    timestamp: str
    ethic: str
    alignment_score: float
    consent: bool
    trusted: bool
    metadata: Mapping[str, object]

    def to_payload(self) -> Mapping[str, object]:
        return {
            "timestamp": self.timestamp,
            "ethic": self.ethic,
            "alignment_score": self.alignment_score,
            "consent": self.consent,
            "trusted": self.trusted,
            "metadata": dict(self.metadata),
        }


class BehavioralEthicsMonitor:
    """Evaluates alignment signals against minimum ethical thresholds."""

    NEGATIVE_ETHICS = {"betrayal", "selfish", "abuse", "drain"}

    def __init__(self, *, threshold: float = 0.72) -> None:
        self.threshold = _clamp(threshold)
        self._events: MutableSequence[_EthicEvent] = []

    def evaluate(self, payload: Mapping[str, object]) -> Mapping[str, object]:
        ethic = str(payload.get("ethic", "aligned")).lower()
        alignment = _clamp(float(payload.get("alignment", payload.get("belief", 0.0))))
        consent = bool(payload.get("consent", True))
        trusted = consent and alignment >= self.threshold and ethic not in self.NEGATIVE_ETHICS
        event = _EthicEvent(
            timestamp=_now_ts(),
            ethic=ethic,
            alignment_score=alignment,
            consent=consent,
            trusted=trusted,
            metadata={
                "source": payload.get("source", "action"),
                "result_alignment": _clamp(float(payload.get("result_alignment", alignment))),
            },
        )
        self._events.append(event)
        return event.to_payload()

    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(event.to_payload() for event in self._events)

    def status(self) -> Mapping[str, object]:
        return {
            "threshold": self.threshold,
            "events_recorded": len(self._events),
            "last_event": self._events[-1].to_payload() if self._events else None,
        }


class ConsentFirstMirror:
    """Mirrors ethics decisions through a consent-first verification lens."""

    def __init__(self, monitor: BehavioralEthicsMonitor | None = None) -> None:
        self.monitor = monitor or BehavioralEthicsMonitor()
        self._verifications: MutableSequence[Mapping[str, object]] = []

    def verify(
        self,
        subject: str,
        *,
        consent: bool,
        review: Mapping[str, object] | None = None,
        alignment: float | None = None,
        ethic: str | None = None,
    ) -> Mapping[str, object]:
        payload = dict(review) if review else {
            "ethic": ethic or "aligned",
            "alignment": alignment if alignment is not None else self.monitor.threshold,
            "consent": consent,
        }
        if review is None:
            payload = self.monitor.evaluate(payload)
        verified = bool(consent and payload.get("trusted", False))
        record = {
            "subject": subject,
            "verified": verified,
            "ethic": payload.get("ethic", "aligned"),
            "alignment_score": payload.get("alignment_score", payload.get("alignment", 0.0)),
            "timestamp": _now_ts(),
        }
        self._verifications.append(record)
        return dict(record)

    def lock_report(self) -> Mapping[str, object]:
        return {
            "verifications": list(self._verifications),
            "all_verified": all(item["verified"] for item in self._verifications) if self._verifications else False,
        }

    def status(self) -> Mapping[str, object]:
        return {
            "verifications_recorded": len(self._verifications),
            "last_verification": self._verifications[-1] if self._verifications else None,
        }

