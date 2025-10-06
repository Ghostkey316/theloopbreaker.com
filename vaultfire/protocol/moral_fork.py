"""Protocol Unique: Moral timeline forking utilities."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, List, Sequence

from .timeflare import TimeFlare

MODULE_TAG = "Protocol Unique"


@dataclass(frozen=True)
class TimelineFork:
    """Represents a branch created by the MoralForkEngine."""

    fork_id: str
    interaction_id: str
    branch: str
    priority: str
    ethic_score: float
    signal_weight: float
    alignment_bias: float
    alignment_history: Sequence[str]
    created_at: datetime

    def to_payload(self) -> dict:
        """Return a serializable representation."""

        return {
            "fork_id": self.fork_id,
            "interaction_id": self.interaction_id,
            "branch": self.branch,
            "priority": self.priority,
            "ethic_score": self.ethic_score,
            "signal_weight": self.signal_weight,
            "alignment_bias": self.alignment_bias,
            "alignment_history": list(self.alignment_history),
            "created_at": self.created_at.isoformat(),
        }


class MoralForkEngine:
    """Evaluate signals to determine when to branch a timeline thread."""

    def __init__(self, *, timeflare: TimeFlare | None = None) -> None:
        self._forks: List[TimelineFork] = []
        self._timeflare = timeflare
        self._counter = 0

    @staticmethod
    def _resolve_alignment_bias(history: Iterable[str]) -> float:
        score = 0.0
        weight = 0.0
        for item in history:
            label = str(item).strip().lower()
            if not label:
                continue
            weight += 1.0
            if label in {"aligned", "stability", "mission"}:
                score += 1.0
            elif label in {"drift", "monitor"}:
                score -= 0.25
            else:
                score -= 0.5
        if weight == 0.0:
            return 0.0
        return score / weight

    def _generate_id(self, interaction_id: str) -> str:
        self._counter += 1
        return f"fork::{interaction_id}::{self._counter:04d}"

    def evaluate(
        self,
        interaction_id: str,
        *,
        ethic_score: float,
        signal_weight: float,
        alignment_history: Sequence[str] = (),
    ) -> TimelineFork:
        """Evaluate the provided context and emit a fork record."""

        bias = self._resolve_alignment_bias(alignment_history)
        composite = (float(ethic_score) * 0.6) + (float(signal_weight) * 0.3) + (bias * 0.1)
        if composite >= 0.65:
            branch = "stable"
            priority = "low"
        elif composite >= 0.45:
            branch = "monitor"
            priority = "medium"
        else:
            branch = "divergent"
            priority = "critical"
        fork = TimelineFork(
            fork_id=self._generate_id(interaction_id),
            interaction_id=interaction_id,
            branch=branch,
            priority=priority,
            ethic_score=float(ethic_score),
            signal_weight=float(signal_weight),
            alignment_bias=bias,
            alignment_history=tuple(alignment_history),
            created_at=datetime.now(timezone.utc),
        )
        self._forks.append(fork)
        if branch != "stable" and self._timeflare is not None:
            self._timeflare.emit(fork)
        return fork

    @property
    def forks(self) -> List[TimelineFork]:
        """Return the recorded fork decisions."""

        return list(self._forks)
