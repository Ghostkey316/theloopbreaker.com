"""Human-AI ethics enforcement utilities for Vaultfire deployments."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping, MutableMapping, MutableSequence, Sequence

__all__ = [
    "BehavioralEthicsMonitor",
    "ConsentFirstMirror",
    "EthicsAutoCorrectSuite",
    "MoralLedger",
]


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


@dataclass(frozen=True)
class _AutoCorrectCheck:
    timestamp: str
    name: str
    passed: bool
    details: Mapping[str, object]

    def to_payload(self) -> Mapping[str, object]:
        return {
            "timestamp": self.timestamp,
            "name": self.name,
            "passed": self.passed,
            "details": dict(self.details),
        }


@dataclass(frozen=True)
class _AutoCorrectRun:
    timestamp: str
    checks: Sequence[_AutoCorrectCheck]
    verified: bool
    summary: Mapping[str, object]

    def to_payload(self) -> Mapping[str, object]:
        return {
            "timestamp": self.timestamp,
            "verified": self.verified,
            "checks": [check.to_payload() for check in self.checks],
            "summary": dict(self.summary),
        }


class EthicsAutoCorrectSuite:
    """High-level helper that exercises multiple ethics safeguards."""

    _runs: MutableSequence[_AutoCorrectRun] = []

    @classmethod
    def full_validation(cls, *, threshold: float = 0.72) -> Mapping[str, object]:
        monitor = BehavioralEthicsMonitor(threshold=threshold)
        mirror = ConsentFirstMirror(monitor)

        trusted_event = monitor.evaluate(
            {
                "ethic": "aligned",
                "alignment": min(1.0, threshold + 0.15),
                "consent": True,
                "source": "auto-correct-suite",
            }
        )
        consent_verification = mirror.verify("baseline", consent=True, review=trusted_event)

        risky_event = monitor.evaluate(
            {
                "ethic": "rumor",
                "alignment": 0.31,
                "consent": True,
                "result_alignment": 0.3,
                "source": "bias-audit",
            }
        )

        consent_block = mirror.verify(
            "consent-block",
            consent=False,
            alignment=threshold + 0.2,
            ethic="aligned",
        )

        checks = (
            _AutoCorrectCheck(
                timestamp=_now_ts(),
                name="baseline_alignment",
                passed=bool(trusted_event.get("trusted")),
                details={"alignment_score": trusted_event.get("alignment_score")},
            ),
            _AutoCorrectCheck(
                timestamp=_now_ts(),
                name="consent_verification",
                passed=bool(consent_verification.get("verified")),
                details={"ethic": consent_verification.get("ethic")},
            ),
            _AutoCorrectCheck(
                timestamp=_now_ts(),
                name="bias_detection",
                passed=not bool(risky_event.get("trusted")),
                details={"ethic": risky_event.get("ethic"), "alignment_score": risky_event.get("alignment_score")},
            ),
            _AutoCorrectCheck(
                timestamp=_now_ts(),
                name="consent_block",
                passed=not bool(consent_block.get("verified")),
                details={"consent": False, "ethic": consent_block.get("ethic")},
            ),
        )

        all_passed = all(check.passed for check in checks)
        summary = {
            "monitor": monitor.status(),
            "mirror": mirror.status(),
            "total_checks": len(checks),
            "passed": sum(int(check.passed) for check in checks),
        }
        run = _AutoCorrectRun(
            timestamp=_now_ts(),
            checks=checks,
            verified=all_passed,
            summary=summary,
        )
        cls._runs.append(run)
        return run.to_payload()

    @classmethod
    def history(cls) -> Sequence[Mapping[str, object]]:
        return tuple(run.to_payload() for run in cls._runs)

    @classmethod
    def last_run(cls) -> Mapping[str, object] | None:
        return cls._runs[-1].to_payload() if cls._runs else None


class MoralLedger:
    """Track moral alignment events with lightweight auditing helpers."""

    _enabled: bool = False
    _config: Mapping[str, object] = {}
    _entries: MutableSequence[Mapping[str, object]] = []
    _history: MutableSequence[Mapping[str, object]] = []

    @classmethod
    def reset(cls) -> None:
        cls._enabled = False
        cls._config = {}
        cls._entries = []
        cls._history = []

    @classmethod
    def enable(
        cls,
        *,
        persistence: bool,
        audit_window: str,
        visibility: str,
    ) -> Mapping[str, object]:
        config = {
            "persistence": bool(persistence),
            "audit_window": str(audit_window).strip(),
            "visibility": str(visibility).strip(),
            "enabled_at": _now_ts(),
        }
        if not config["audit_window"]:
            raise ValueError("audit_window cannot be empty")
        if not config["visibility"]:
            raise ValueError("visibility cannot be empty")
        cls._enabled = True
        cls._config = config
        cls._history.append({
            "type": "enable",
            "timestamp": config["enabled_at"],
            "payload": dict(config),
        })
        return dict(config)

    @classmethod
    def record(
        cls,
        action: str,
        *,
        weight: float = 1.0,
        tags: Sequence[str] | None = None,
        metadata: Mapping[str, object] | None = None,
    ) -> Mapping[str, object]:
        if not cls._enabled:
            raise RuntimeError("MoralLedger must be enabled before recording events")
        label = str(action).strip()
        if not label:
            raise ValueError("action cannot be empty")
        timestamp = _now_ts()
        tag_payload = tuple(
            tag
            for tag in (str(tag).strip() for tag in tags or ())
            if tag
        )
        entry: MutableMapping[str, object] = {
            "action": label,
            "weight": float(weight),
            "timestamp": timestamp,
        }
        if tag_payload:
            entry["tags"] = tag_payload
        if metadata is not None:
            entry["metadata"] = dict(metadata)
        cls._entries.append(dict(entry))
        cls._history.append({
            "type": "record",
            "timestamp": timestamp,
            "payload": dict(entry),
        })
        return dict(entry)

    @classmethod
    def audit(cls) -> Mapping[str, object]:
        entries = tuple(dict(entry) for entry in cls._entries)
        total_weight = sum(float(entry["weight"]) for entry in entries)
        return {
            "enabled": cls._enabled,
            "config": dict(cls._config),
            "entries": entries,
            "summary": {
                "entries_recorded": len(entries),
                "total_weight": total_weight,
            },
        }

    @classmethod
    def history(cls) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in cls._history)

    @classmethod
    def status(cls) -> Mapping[str, object]:
        audit_report = cls.audit()
        return {
            "enabled": audit_report["enabled"],
            "config": audit_report["config"],
            "entries_recorded": audit_report["summary"]["entries_recorded"],
            "history": cls.history(),
        }

