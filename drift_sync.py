"""Vaultfire Drift Protocol core for time-based identity motion.

This module tracks prompt cadence, belief streaks, emotional consistency,
and inactivity gaps to derive a dynamic Drift Score for each user.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable, Dict, List, Mapping, Sequence


@dataclass(slots=True)
class DriftMetrics:
    """Aggregated behavioral signals for a single user."""

    prompt_cadence: List[float] = field(default_factory=list)
    belief_streak: int = 0
    emotional_consistency: float = 1.0
    inactivity_gaps: List[float] = field(default_factory=list)
    drift_score: float = 0.0


@dataclass(slots=True)
class PromptEvent:
    """Individual prompt interaction with belief and sentiment context."""

    timestamp: datetime
    belief: float
    sentiment: float


class DriftSync:
    """Compute Drift Scores based on evolving prompt behavior."""

    def __init__(
        self,
        *,
        inactivity_threshold: timedelta = timedelta(hours=6),
        time_source: Callable[[], datetime] | None = None,
    ) -> None:
        self._events: Dict[str, List[PromptEvent]] = {}
        self._metrics: Dict[str, DriftMetrics] = {}
        self._inactivity_threshold = inactivity_threshold
        self._time_source = time_source or datetime.utcnow

    def record_prompt(
        self,
        user_id: str,
        *,
        belief: float,
        sentiment: float,
        timestamp: datetime | None = None,
    ) -> DriftMetrics:
        """Record a prompt event and update Drift metrics."""

        event_time = timestamp or self._time_source()
        history = self._events.setdefault(user_id, [])
        history.append(PromptEvent(timestamp=event_time, belief=belief, sentiment=sentiment))
        history.sort(key=lambda e: e.timestamp)
        metrics = self._metrics.setdefault(user_id, DriftMetrics())
        self._recalculate(user_id, metrics, history)
        return metrics

    def get_metrics(self, user_id: str) -> DriftMetrics:
        """Return the latest metrics for a user."""

        return self._metrics.get(user_id, DriftMetrics())

    def drift_score(self, user_id: str) -> float:
        """Return the Drift Score for a user, recalculating if needed."""

        metrics = self.get_metrics(user_id)
        if user_id in self._events:
            self._recalculate(user_id, metrics, self._events[user_id])
        return metrics.drift_score

    def _recalculate(
        self, user_id: str, metrics: DriftMetrics, history: Sequence[PromptEvent]
    ) -> None:
        if not history:
            metrics.prompt_cadence.clear()
            metrics.inactivity_gaps.clear()
            metrics.belief_streak = 0
            metrics.emotional_consistency = 1.0
            metrics.drift_score = 0.0
            return

        prompt_cadence: List[float] = []
        inactivity_gaps: List[float] = []
        belief_streak = 1

        previous_event = history[0]
        sentiments = [previous_event.sentiment]
        for event in history[1:]:
            delta = (event.timestamp - previous_event.timestamp).total_seconds()
            prompt_cadence.append(delta)
            if delta >= self._inactivity_threshold.total_seconds():
                inactivity_gaps.append(delta)
                belief_streak = 1
            else:
                if abs(event.belief - previous_event.belief) <= 0.08:
                    belief_streak += 1
                else:
                    belief_streak = 1
            sentiments.append(event.sentiment)
            previous_event = event

        emotional_consistency = self._emotional_consistency(sentiments)
        drift_score = self._drift_score(
            prompt_cadence,
            belief_streak,
            emotional_consistency,
            inactivity_gaps,
        )

        metrics.prompt_cadence = prompt_cadence
        metrics.belief_streak = belief_streak
        metrics.emotional_consistency = emotional_consistency
        metrics.inactivity_gaps = inactivity_gaps
        metrics.drift_score = drift_score

    @staticmethod
    def _emotional_consistency(sentiments: Sequence[float]) -> float:
        if len(sentiments) <= 1:
            return 1.0
        deviation = statistics.pstdev(sentiments)
        scaled = max(0.0, 1.0 - min(1.0, deviation / 2))
        return round(scaled, 4)

    @staticmethod
    def _drift_score(
        cadence: Sequence[float],
        belief_streak: int,
        emotional_consistency: float,
        inactivity_gaps: Sequence[float],
    ) -> float:
        if not cadence:
            cadence_stability = 1.0
        else:
            mean_cadence = statistics.mean(cadence)
            deviation = statistics.pstdev(cadence) if len(cadence) > 1 else 0.0
            cadence_stability = max(0.0, 1.0 - (deviation / (mean_cadence + 1e-6)))
        streak_bonus = min(1.0, belief_streak / 5)
        inactivity_penalty = min(0.5, 0.05 * len(inactivity_gaps))
        weighted = (
            0.4 * cadence_stability
            + 0.35 * streak_bonus
            + 0.25 * emotional_consistency
        )
        score = max(0.0, min(316.0, 316.0 * weighted * (1.0 - inactivity_penalty)))
        return round(score, 2)


__all__: Mapping[str, type] = {"DriftSync": DriftSync, "DriftMetrics": DriftMetrics}
