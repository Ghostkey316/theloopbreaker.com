"""Memory thread serialization across SoulPrint and Sensation layers."""

from __future__ import annotations

import hashlib
import json
import statistics
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, List, Mapping, Sequence

from drift_sync import DriftSync
from vaultfire.sensation.modules import ResonanceSnapshot, SenseWeaveCore
from vaultfire.soul.soulprint_core import SoulPrint, SoulPrintCore


@dataclass(frozen=True)
class TimeAnchor:
    """Chronological marker with emotional timestamp metadata."""

    block_start: datetime
    block_end: datetime
    emotional_timestamp: float
    ordinal: int

    def to_payload(self) -> Mapping[str, object]:
        return {
            "block_start": self.block_start.replace(tzinfo=timezone.utc).isoformat(),
            "block_end": self.block_end.replace(tzinfo=timezone.utc).isoformat(),
            "ordinal": self.ordinal,
            "emotional_timestamp": round(self.emotional_timestamp, 6),
        }


class TimePulseSync:
    """Anchor memory events to deterministic time blocks and emotional pulses."""

    def __init__(
        self,
        *,
        block_span: timedelta | int = timedelta(minutes=5),
        time_source: Callable[[], datetime] | None = None,
    ) -> None:
        if isinstance(block_span, int):
            block_span = timedelta(seconds=block_span)
        if block_span.total_seconds() <= 0:
            raise ValueError("block_span must be positive")
        self.block_span = block_span
        self._time_source = time_source or datetime.utcnow

    def anchor(
        self, *, timestamp: datetime | None = None, emotional_intensity: float = 0.0
    ) -> TimeAnchor:
        event_time = timestamp or self._time_source()
        block_seconds = int(self.block_span.total_seconds())
        ordinal = int(event_time.timestamp()) // block_seconds
        block_start = datetime.utcfromtimestamp(ordinal * block_seconds)
        block_end = block_start + self.block_span
        emotional_timestamp = ordinal + float(emotional_intensity)
        return TimeAnchor(
            block_start=block_start,
            block_end=block_end,
            emotional_timestamp=emotional_timestamp,
            ordinal=ordinal,
        )


@dataclass(frozen=True)
class MemoryEvent:
    """Serialized memory event across SoulPrint and SenseWeave."""

    user_id: str
    prompt: str
    soulprint: SoulPrint
    resonance: ResonanceSnapshot
    drift_score: float
    anchor: TimeAnchor
    memory_hash: str
    payload: Mapping[str, object]


class MemoryThreadCore:
    """Serialize long-term signals across SoulPrintCore and SenseWeaveCore."""

    def __init__(
        self,
        *,
        soul_core: SoulPrintCore | None = None,
        sense_core: SenseWeaveCore | None = None,
        drift_sync: DriftSync | None = None,
        time_pulse: TimePulseSync | None = None,
    ) -> None:
        self.soul_core = soul_core or SoulPrintCore()
        self.sense_core = sense_core or SenseWeaveCore()
        self.drift_sync = drift_sync or DriftSync()
        self.time_pulse = time_pulse or TimePulseSync()
        self._threads: Dict[str, List[MemoryEvent]] = {}

    def _memory_factors(
        self,
        *,
        user_id: str,
        prompt: str,
        soulprint: SoulPrint,
        resonance: ResonanceSnapshot,
        anchor: TimeAnchor,
        drift_score: float,
    ) -> Mapping[str, object]:
        return {
            "user": user_id,
            "prompt": prompt,
            "soulprint": soulprint.hash,
            "resonance": resonance.hash,
            "anchor": anchor.to_payload(),
            "drift_score": drift_score,
        }

    def _hash_memory(self, payload: Mapping[str, object]) -> str:
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        return hashlib.sha256(serialized).hexdigest()

    def record_memory(
        self,
        user_id: str,
        *,
        prompt: str,
        heart_rate: float,
        galvanic_skin_response: float,
        voice_tremor: float,
        emotional_delta: Mapping[str, float] | None = None,
        timestamp: datetime | None = None,
    ) -> MemoryEvent:
        """Capture biometrics, sync drift, and serialize a memory event."""

        resonance = self.sense_core.capture(
            heart_rate=heart_rate,
            galvanic_skin_response=galvanic_skin_response,
            voice_tremor=voice_tremor,
            emotional_delta=emotional_delta,
        )
        sentiment_anchor = statistics.mean(resonance.resonance.values()) if resonance.resonance else 0.0
        drift_metrics = self.drift_sync.record_prompt(
            user_id,
            belief=resonance.sensation_score / 316.0,
            sentiment=sentiment_anchor,
            timestamp=timestamp,
        )
        anchor = self.time_pulse.anchor(
            timestamp=timestamp,
            emotional_intensity=resonance.sensation_score / 316.0,
        )
        soulprint = self.soul_core.generate(
            prompt_cadence=drift_metrics.prompt_cadence or [0.0],
            mirror_echoes=tuple(f"{k}:{v}" for k, v in resonance.resonance.items()),
            drift_patterns={
                "drift_score": drift_metrics.drift_score,
                "belief_streak": drift_metrics.belief_streak,
            },
            belief_deltas={"sensation": resonance.sensation_score / 316.0},
            emotional_profile=resonance.resonance,
        )
        payload = self._memory_factors(
            user_id=user_id,
            prompt=prompt,
            soulprint=soulprint,
            resonance=resonance,
            anchor=anchor,
            drift_score=drift_metrics.drift_score,
        )
        memory_hash = self._hash_memory(payload)
        event = MemoryEvent(
            user_id=user_id,
            prompt=prompt,
            soulprint=soulprint,
            resonance=resonance,
            drift_score=drift_metrics.drift_score,
            anchor=anchor,
            memory_hash=memory_hash,
            payload=payload,
        )
        self._threads.setdefault(user_id, []).append(event)
        return event

    def thread(self, user_id: str) -> Sequence[MemoryEvent]:
        """Return the serialized memory thread for a user."""

        return tuple(self._threads.get(user_id, ()))


__all__ = ["MemoryEvent", "MemoryThreadCore", "TimeAnchor", "TimePulseSync"]
