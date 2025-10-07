"""Adaptive consciousness utilities for Vaultfire moral equilibrium loops."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable, Mapping, MutableMapping, MutableSequence, Sequence

__all__ = [
    "CognitiveEquilibriumEngine",
    "TruthfieldResonator",
    "CompassionOverdriveLayer",
    "PulsewatchSyncStatus",
]


_DEF_EMOTION_WEIGHTS: Mapping[str, float] = {
    "focus": 0.6,
    "empathy": 0.82,
    "courage": 0.7,
    "calm": 0.58,
    "urgency": 0.52,
    "wonder": 0.66,
}


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


@dataclass(frozen=True)
class _EquilibriumFrame:
    timestamp: str
    emotion: str
    logic_focus: float
    emotional_weight: float
    equilibrium: float
    divergence: float
    context: Mapping[str, object]

    def to_payload(self) -> Mapping[str, object]:
        return {
            "timestamp": self.timestamp,
            "emotion": self.emotion,
            "logic_focus": self.logic_focus,
            "emotional_weight": self.emotional_weight,
            "equilibrium": self.equilibrium,
            "divergence": self.divergence,
            "context": dict(self.context),
        }


class CognitiveEquilibriumEngine:
    """Balances logical scoring with emotional weighting for Vaultfire actions."""

    def __init__(
        self,
        *,
        identity_handle: str | None = None,
        identity_ens: str | None = None,
        baseline: float = 0.55,
        emotion_weights: Mapping[str, float] | None = None,
    ) -> None:
        self.identity_handle = identity_handle or "anonymous"
        self.identity_ens = identity_ens or "unknown"
        self._baseline = _clamp(baseline)
        self._emotion_weights: MutableMapping[str, float] = {
            key.lower(): _clamp(value)
            for key, value in (emotion_weights or _DEF_EMOTION_WEIGHTS).items()
        }
        self._history: MutableSequence[_EquilibriumFrame] = []
        self._last_equilibrium: float | None = None

    def balance(
        self,
        *,
        belief: float,
        action_alignment: float,
        result_alignment: float,
        emotion: str,
        moral_pressure: float | None = None,
        tags: Sequence[str] | None = None,
    ) -> Mapping[str, object]:
        emotion_key = str(emotion or "neutral").strip().lower()
        logic_focus = _clamp((belief + action_alignment + result_alignment) / 3.0)
        bias = self._emotion_weights.get(emotion_key, self._baseline)
        pressure = _clamp(self._baseline + (moral_pressure or 0.0) * 0.3)
        emotional_weight = _clamp((bias + pressure) / 2.0)
        equilibrium = _clamp((logic_focus * 0.65) + (emotional_weight * 0.35))
        divergence = abs(logic_focus - emotional_weight)
        frame = _EquilibriumFrame(
            timestamp=_now_ts(),
            emotion=emotion_key or "neutral",
            logic_focus=logic_focus,
            emotional_weight=emotional_weight,
            equilibrium=equilibrium,
            divergence=divergence,
            context={
                "identity": {
                    "wallet": self.identity_handle,
                    "ens": self.identity_ens,
                },
                "tags": list(tags or ()),
            },
        )
        self._history.append(frame)
        self._last_equilibrium = equilibrium
        return frame.to_payload()

    def recalibrate(
        self,
        *,
        baseline: float | None = None,
        emotion_weights: Mapping[str, float] | None = None,
    ) -> Mapping[str, float]:
        if baseline is not None:
            self._baseline = _clamp(baseline)
        if emotion_weights:
            for key, value in emotion_weights.items():
                self._emotion_weights[str(key).lower()] = _clamp(float(value))
        return {
            "baseline": self._baseline,
            "emotion_weights": dict(self._emotion_weights),
        }

    def status(self) -> Mapping[str, object]:
        if not self._history:
            average = self._baseline
            divergence = 0.0
            last_event: Mapping[str, object] | None = None
        else:
            average = sum(frame.equilibrium for frame in self._history) / len(self._history)
            divergence = sum(frame.divergence for frame in self._history) / len(self._history)
            last_event = self._history[-1].to_payload()
        return {
            "baseline": self._baseline,
            "average_equilibrium": average,
            "average_divergence": divergence,
            "last_event": last_event,
        }

    @property
    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(frame.to_payload() for frame in self._history)


@dataclass(frozen=True)
class _TruthfieldSnapshot:
    timestamp: str
    statement: str
    integrity_score: float
    bias_index: float
    misinformation: bool
    source: str
    metadata: Mapping[str, object] = field(default_factory=dict)

    def to_payload(self) -> Mapping[str, object]:
        return {
            "timestamp": self.timestamp,
            "statement": self.statement,
            "integrity_score": self.integrity_score,
            "bias_index": self.bias_index,
            "misinformation": self.misinformation,
            "source": self.source,
            "metadata": dict(self.metadata),
        }


class TruthfieldResonator:
    """Detects misinformation and bias across connected ledgers."""

    def __init__(self, *, tolerance: float = 0.18) -> None:
        self.tolerance = _clamp(tolerance, 0.05, 0.5)
        self._sources: set[str] = set()
        self._log: MutableSequence[_TruthfieldSnapshot] = []

    def calibrate_sources(self, sources: Iterable[str]) -> Sequence[str]:
        for source in sources:
            label = str(source or "").strip().lower()
            if label:
                self._sources.add(label)
        return tuple(sorted(self._sources))

    def scan(
        self,
        *,
        statement: str,
        confidence: float,
        source: str | None = None,
        source_bias: float | None = None,
        tags: Sequence[str] | None = None,
        contradictions: Sequence[str] | int | None = None,
    ) -> Mapping[str, object]:
        source_label = str(source or "unknown").strip().lower() or "unknown"
        self._sources.add(source_label)
        confidence_score = _clamp(confidence)
        bias_value = abs(float(source_bias)) if source_bias is not None else 0.0
        bias_index = _clamp(bias_value)
        if isinstance(contradictions, Sequence) and not isinstance(contradictions, (str, bytes)):
            contradiction_score = min(1.0, len(list(contradictions)) * 0.05)
        elif contradictions:
            contradiction_score = min(1.0, float(contradictions) * 0.05)
        else:
            contradiction_score = 0.0
        sentiment_penalty = 0.0
        sentinel_tags = {"rumor", "speculative", "uncertain", "contest"}
        if tags and any(tag.lower() in sentinel_tags for tag in tags):
            sentiment_penalty = 0.08
        composite_bias = _clamp(bias_index + contradiction_score + sentiment_penalty)
        integrity = _clamp(confidence_score * (1.0 - composite_bias))
        misinformation_flag = integrity + self.tolerance < confidence_score
        snapshot = _TruthfieldSnapshot(
            timestamp=_now_ts(),
            statement=str(statement),
            integrity_score=integrity,
            bias_index=composite_bias,
            misinformation=misinformation_flag,
            source=source_label,
            metadata={
                "confidence": confidence_score,
                "tolerance": self.tolerance,
                "tags": list(tags or ()),
            },
        )
        self._log.append(snapshot)
        return snapshot.to_payload()

    def status(self) -> Mapping[str, object]:
        if not self._log:
            return {
                "sources": tuple(sorted(self._sources)),
                "last_snapshot": None,
                "average_integrity": None,
            }
        average = sum(item.integrity_score for item in self._log) / len(self._log)
        return {
            "sources": tuple(sorted(self._sources)),
            "last_snapshot": self._log[-1].to_payload(),
            "average_integrity": average,
        }

    @property
    def resonance_log(self) -> Sequence[Mapping[str, object]]:
        return tuple(item.to_payload() for item in self._log)


@dataclass(frozen=True)
class _CompassionEvent:
    timestamp: str
    context: str
    level: float
    amplified: bool
    metadata: Mapping[str, object]

    def to_payload(self) -> Mapping[str, object]:
        return {
            "timestamp": self.timestamp,
            "context": self.context,
            "level": self.level,
            "amplified": self.amplified,
            "metadata": dict(self.metadata),
        }


class CompassionOverdriveLayer:
    """Amplifies human-centric empathy responses under pressure."""

    def __init__(self, *, base_level: float = 0.65) -> None:
        self._base_level = _clamp(base_level)
        self._current_level = self._base_level
        self._history: MutableSequence[_CompassionEvent] = []

    def boost(
        self,
        *,
        context: str,
        severity: float,
        empathy_tags: Sequence[str] | None = None,
        consent_granted: bool = True,
    ) -> Mapping[str, object]:
        severity_score = _clamp(severity)
        empathy_bonus = 0.0
        if empathy_tags and any(tag.lower() in {"care", "support", "relief", "aid"} for tag in empathy_tags):
            empathy_bonus = 0.12
        consent_penalty = -0.15 if not consent_granted else 0.0
        target_level = _clamp(
            self._base_level + severity_score * 0.4 + empathy_bonus + consent_penalty
        )
        previous_level = self._current_level
        self._current_level = max(self._current_level, target_level)
        event = _CompassionEvent(
            timestamp=_now_ts(),
            context=str(context),
            level=self._current_level,
            amplified=self._current_level > previous_level,
            metadata={
                "severity": severity_score,
                "base_level": self._base_level,
                "empathy_tags": list(empathy_tags or ()),
                "consent": consent_granted,
            },
        )
        self._history.append(event)
        return event.to_payload()

    def decay(self, *, ratio: float = 0.15) -> float:
        ratio_value = _clamp(ratio)
        drop = (self._current_level - self._base_level) * ratio_value
        self._current_level = _clamp(self._current_level - drop)
        return self._current_level

    def status(self) -> Mapping[str, object]:
        return {
            "base_level": self._base_level,
            "current_level": self._current_level,
            "events_recorded": len(self._history),
            "last_event": self._history[-1].to_payload() if self._history else None,
        }

    @property
    def current_level(self) -> float:
        return self._current_level

    @property
    def events(self) -> Sequence[Mapping[str, object]]:
        return tuple(event.to_payload() for event in self._history)


@dataclass(frozen=True)
class _PulsewatchAlignment:
    timestamp: str
    axes: Sequence[str]
    status: str
    telemetry: Mapping[str, object]

    def to_payload(self) -> Mapping[str, object]:
        return {
            "timestamp": self.timestamp,
            "axes": list(self.axes),
            "status": self.status,
            "telemetry": dict(self.telemetry),
        }


class PulsewatchSyncStatus:
    """Tracks cross-domain alignment confirmations for Pulsewatch telemetry."""

    _history: MutableSequence[_PulsewatchAlignment] = []

    @classmethod
    def confirm_alignment(
        cls,
        *axes: str,
        status: str = "aligned",
        telemetry: Mapping[str, object] | None = None,
    ) -> Mapping[str, object]:
        """Record a synchronisation event across the provided axes."""

        normalised_axes = tuple(
            axis.strip().lower()
            for axis in (axes or ("alignment",))
            if str(axis).strip()
        )
        if not normalised_axes:
            raise ValueError("at least one alignment axis must be provided")
        payload = _PulsewatchAlignment(
            timestamp=_now_ts(),
            axes=normalised_axes,
            status=str(status or "aligned").lower(),
            telemetry=dict(telemetry or {}),
        )
        cls._history.append(payload)
        return payload.to_payload()

    @classmethod
    def history(cls) -> Sequence[Mapping[str, object]]:
        return tuple(item.to_payload() for item in cls._history)

    @classmethod
    def last_alignment(cls) -> Mapping[str, object] | None:
        return cls._history[-1].to_payload() if cls._history else None
