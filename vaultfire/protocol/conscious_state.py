"""Protocol Unique: Conscious state evaluation with fork emission."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, MutableMapping, Sequence

from .moral_fork import MoralForkEngine, TimelineFork
from .signal_echo import SignalEchoEngine

MODULE_TAG = "Protocol Unique"


@dataclass
class ConsciousSnapshot:
    """Represents the evaluation of a conscious state reading."""

    interaction_id: str
    belief_score: float
    mission_score: float
    drift: float
    deviation: float
    status: str
    fork: TimelineFork | None


class ConsciousStateEngine:
    """Evaluate belief drift and mission deviation to emit fork candidates."""

    def __init__(
        self,
        *,
        signal_engine: SignalEchoEngine,
        fork_engine: MoralForkEngine,
        drift_threshold: float = 0.2,
        deviation_threshold: float = 0.25,
    ) -> None:
        self._signal_engine = signal_engine
        self._fork_engine = fork_engine
        self._drift_threshold = drift_threshold
        self._deviation_threshold = deviation_threshold
        self._last_scores: MutableMapping[str, tuple[float, float]] = {}
        self._snapshots: list[ConsciousSnapshot] = []

    def capture(
        self,
        interaction_id: str,
        *,
        belief_score: float,
        mission_score: float,
        emotion: str,
        ethic: str,
        intensity: float | None = None,
        tags: Sequence[str] = (),
        metadata: Mapping[str, object] | None = None,
    ) -> ConsciousSnapshot:
        """Capture a state reading and evaluate potential forks."""

        resolved_intensity = belief_score if intensity is None else intensity
        self._signal_engine.record_frame(
            interaction_id,
            emotion=emotion,
            ethic=ethic,
            intensity=resolved_intensity,
            tags=tags,
            metadata=metadata,
        )
        previous = self._last_scores.get(interaction_id)
        drift = 0.0
        deviation = 0.0
        if previous is not None:
            previous_belief, previous_mission = previous
            drift = abs(belief_score - previous_belief)
            deviation = abs(mission_score - previous_mission)
        self._last_scores[interaction_id] = (belief_score, mission_score)

        status = "stable"
        fork: TimelineFork | None = None
        if drift >= self._drift_threshold or deviation >= self._deviation_threshold:
            status = "fork-candidate"
            signal_weight = self._signal_engine.signal_weight(interaction_id)
            alignment_history = self._signal_engine.ethic_history(interaction_id, limit=6)
            ethic_score = max(min(1.0 - deviation, 1.0), 0.0)
            fork = self._fork_engine.evaluate(
                interaction_id,
                ethic_score=ethic_score,
                signal_weight=signal_weight,
                alignment_history=alignment_history,
            )
        snapshot = ConsciousSnapshot(
            interaction_id=interaction_id,
            belief_score=belief_score,
            mission_score=mission_score,
            drift=drift,
            deviation=deviation,
            status=status,
            fork=fork,
        )
        self._snapshots.append(snapshot)
        return snapshot

    @property
    def snapshots(self) -> Sequence[ConsciousSnapshot]:
        """Return the recorded snapshots."""

        return tuple(self._snapshots)
