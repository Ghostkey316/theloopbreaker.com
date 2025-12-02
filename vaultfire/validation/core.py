"""Vaultfire Validation Layer v1.0 core primitives."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Mapping, Sequence

from vaultfire.identity.layer import IdentityAnchor, IdentityWeaveCore
from vaultfire.memory.modules.memory_thread import MemoryEvent, MemoryThreadCore, TimeAnchor, TimePulseSync


@dataclass(frozen=True)
class ValidationReport:
    """Immutable representation of a validator decision."""

    persona_tag: str
    zk_consistent: bool
    soulprint_match: bool
    continuity_verified: bool
    belief_hash: str
    drift_detected: bool
    ethics_alignment: float
    ethics_state: str
    validator_score: float
    continuity_hash: str


class BeliefProofEngine:
    """Compare belief hashes across identity and memory layers."""

    def __init__(self, *, ethics_floor: float = 0.6) -> None:
        self.ethics_floor = ethics_floor

    def _ethics_alignment(self, ethics_vector: Mapping[str, float] | None) -> float:
        if not ethics_vector:
            return 0.75
        valid = [float(value) for value in ethics_vector.values() if isinstance(value, (int, float))]
        if not valid:
            return 0.75
        average = sum(valid) / len(valid)
        return max(0.0, min(1.0, round(average, 4)))

    def belief_hash(
        self,
        anchor: IdentityAnchor,
        memory_event: MemoryEvent,
        *,
        ethics_vector: Mapping[str, float] | None = None,
    ) -> str:
        drift_signal = float(memory_event.drift_score) / 316.0 if memory_event.drift_score else 0.0
        payload = {
            "identity": anchor.identity_hash,
            "soulprint": anchor.soulprint_hash,
            "memory": memory_event.memory_hash,
            "drift": round(drift_signal, 6),
            "ethics": self._ethics_alignment(ethics_vector),
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        return hashlib.blake2s(serialized, person=b"VFBELIEF").hexdigest()

    def compare(
        self,
        anchor: IdentityAnchor,
        memory_event: MemoryEvent,
        *,
        previous_hash: str | None = None,
        ethics_vector: Mapping[str, float] | None = None,
    ) -> Mapping[str, object]:
        current_hash = self.belief_hash(anchor, memory_event, ethics_vector=ethics_vector)
        ethics_alignment = self._ethics_alignment(ethics_vector)
        drift_signal = float(memory_event.drift_score) / 316.0 if memory_event.drift_score else 0.0
        drift_detected = previous_hash is not None and previous_hash != current_hash
        drift_detected = drift_detected or abs(drift_signal - ethics_alignment) > 0.35
        ethics_state = "aligned" if ethics_alignment >= self.ethics_floor else "violation"
        return {
            "belief_hash": current_hash,
            "drift_detected": drift_detected,
            "ethics_alignment": ethics_alignment,
            "ethics_state": ethics_state,
        }


class EpochLockTracer:
    """Snapshot validator state with decay-aware versioning."""

    def __init__(self, *, decay_window: timedelta | int = timedelta(minutes=20)) -> None:
        if isinstance(decay_window, int):
            decay_window = timedelta(seconds=decay_window)
        if decay_window.total_seconds() <= 0:
            raise ValueError("decay_window must be positive")
        self.decay_window = decay_window
        self._snapshots: list[Mapping[str, object]] = []

    @property
    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(self._snapshots)

    def _decay_factor(self, timestamp: datetime) -> float:
        if not self._snapshots:
            return 1.0
        previous_timestamp = self._snapshots[-1]["timestamp"]
        if not isinstance(previous_timestamp, datetime):
            return 1.0
        delta = (timestamp - previous_timestamp).total_seconds()
        window = self.decay_window.total_seconds()
        if delta <= 0:
            return 1.0
        factor = max(0.1, round(1 - min(delta / window, 0.9), 3))
        return factor

    def snapshot(
        self,
        state: Mapping[str, object],
        *,
        version: str = "v1",
        timestamp: datetime | None = None,
    ) -> Mapping[str, object]:
        ts = timestamp or datetime.utcnow()
        record = {
            "timestamp": ts,
            "version": version,
            "decay": self._decay_factor(ts),
            "state": state,
        }
        self._snapshots.append(record)
        return record


class ValidatorCore:
    """Verify zk-identity, SoulPrint anchors, and continuity across layers."""

    def __init__(
        self,
        *,
        identity_core: IdentityWeaveCore | None = None,
        memory_core: MemoryThreadCore | None = None,
        belief_engine: BeliefProofEngine | None = None,
        tracer: EpochLockTracer | None = None,
    ) -> None:
        self.identity_core = identity_core or IdentityWeaveCore()
        self.memory_core = memory_core or MemoryThreadCore()
        self.belief_engine = belief_engine or BeliefProofEngine()
        self.tracer = tracer or EpochLockTracer()

    def _zk_identity_hash(self, anchor: IdentityAnchor, memory_hash: str) -> str:
        payload = {
            "identity": anchor.identity_hash,
            "memory": memory_hash,
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        return hashlib.blake2s(serialized, person=b"VF-ZKID").hexdigest()

    def _continuity_hash(self, time_anchor: TimeAnchor) -> str:
        serialized = json.dumps(time_anchor.to_payload(), sort_keys=True, separators=(",", ":")).encode()
        return hashlib.sha256(serialized).hexdigest()

    def validate(
        self,
        persona_tag: str,
        *,
        anchor: IdentityAnchor,
        memory_event: MemoryEvent,
        zk_identity_hash: str | None = None,
        continuity_hash: str | None = None,
        ethics_vector: Mapping[str, float] | None = None,
    ) -> ValidationReport:
        expected_zk = self._zk_identity_hash(anchor, memory_event.memory_hash)
        zk_consistent = zk_identity_hash is None or zk_identity_hash == expected_zk
        expected_continuity = self._continuity_hash(memory_event.anchor)
        continuity_verified = continuity_hash is None or continuity_hash == expected_continuity
        soulprint_match = anchor.soulprint_hash == memory_event.soulprint.hash
        belief = self.belief_engine.compare(
            anchor,
            memory_event,
            previous_hash=None,
            ethics_vector=ethics_vector,
        )
        validator_score = round(
            (
                (1.0 if zk_consistent else 0.0)
                + (1.0 if soulprint_match else 0.0)
                + (1.0 if continuity_verified else 0.0)
                + (1.0 if not belief["drift_detected"] else 0.0)
            )
            / 4,
            3,
        )
        report = ValidationReport(
            persona_tag=persona_tag,
            zk_consistent=zk_consistent,
            soulprint_match=soulprint_match,
            continuity_verified=continuity_verified,
            belief_hash=belief["belief_hash"],
            drift_detected=bool(belief["drift_detected"]),
            ethics_alignment=float(belief["ethics_alignment"]),
            ethics_state=str(belief["ethics_state"]),
            validator_score=validator_score,
            continuity_hash=expected_continuity,
        )
        self.tracer.snapshot(
            {
                "persona": persona_tag,
                "zk": zk_consistent,
                "soulprint": soulprint_match,
                "continuity": continuity_verified,
                "ethics": belief["ethics_state"],
                "score": validator_score,
            }
        )
        return report

    def recover_zk(self, anchor: IdentityAnchor, memory_event: MemoryEvent) -> str:
        """Regenerate the zk hash for downstream recovery flows."""

        return self._zk_identity_hash(anchor, memory_event.memory_hash)

    def continuity_checksum(self, time_anchor: TimeAnchor | None = None) -> str:
        anchor = time_anchor or TimePulseSync().anchor()
        return self._continuity_hash(anchor)

    def validate_thread(self, persona_tag: str, events: Iterable[MemoryEvent], anchor: IdentityAnchor) -> Sequence[ValidationReport]:
        reports = []
        for event in events:
            reports.append(self.validate(persona_tag, anchor=anchor, memory_event=event))
        return tuple(reports)


__all__ = [
    "BeliefProofEngine",
    "EpochLockTracer",
    "ValidationReport",
    "ValidatorCore",
]
