"""Ethics-aware tempo engine for Vaultfire Ghostkey synchronization."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Mapping, MutableSequence, Tuple


@dataclass(frozen=True)
class ActionRecord:
    """A read-only record capturing an action and the resolved weight."""

    action: Mapping[str, object]
    weight: int


class MoralMomentumIndex:
    """Tracks a rolling moral momentum score for a sequence of actions."""

    #: Canonical weights for the supported action types.
    _ACTION_WEIGHTS: Dict[str, int] = {
        "sacrifice": 5,
        "support": 3,
        "selfish": -4,
        "betrayal": -10,
    }

    def __init__(self) -> None:
        self._score: int = 0
        self._history: MutableSequence[ActionRecord] = []

    def update(self, action: Mapping[str, object]) -> None:
        """Add a new action to the index and update the score."""

        weight = self._ethics_weight(action)
        self._score += weight
        self._history.append(ActionRecord(action=action, weight=weight))

    def _ethics_weight(self, action: Mapping[str, object]) -> int:
        """Resolve the weight for the provided action."""

        action_type = str(action.get("type", "")).lower()
        if action_type in self._ACTION_WEIGHTS:
            return self._ACTION_WEIGHTS[action_type]
        return int(action.get("weight", 0))

    def get_score(self) -> int:
        """Return the current non-negative score."""

        return max(self._score, 0)

    @property
    def history(self) -> Iterable[ActionRecord]:
        """Expose a copy of the recorded action history."""

        return list(self._history)


class TemporalTrustGate:
    """Derives access tempo from the moral momentum score."""

    def __init__(self, mmi: MoralMomentumIndex) -> None:
        self._mmi = mmi

    def access_window(self) -> str:
        """Return the access speed category based on the MMI score."""

        score = self._mmi.get_score()
        if score > 100:
            return "ultrafast"
        if score > 50:
            return "fast"
        if score > 20:
            return "normal"
        return "slow"


class GhostkeySyncEngine:
    """Simple log that mirrors actions for Ghostkey synchronization."""

    def __init__(self, user_id: str) -> None:
        self.user_id = user_id
        self._logs: List[Mapping[str, object]] = []

    def log_event(self, event: Mapping[str, object]) -> None:
        """Record a new event for the user."""

        self._logs.append(dict(event))

    def replay_history(self) -> List[Mapping[str, object]]:
        """Return a defensive copy of the logged events."""

        return [dict(event) for event in self._logs]


class EthicResonantTimeEngine:
    """Coordinates moral scoring with Ghostkey synchronization."""

    def __init__(self, user_id: str) -> None:
        self.mmi = MoralMomentumIndex()
        self.ttg = TemporalTrustGate(self.mmi)
        self.ghostkey = GhostkeySyncEngine(user_id)

    def register_action(self, action: Mapping[str, object]) -> None:
        """Register an action with both Ghostkey sync and moral index."""

        self.ghostkey.log_event(action)
        self.mmi.update(action)

    def current_tempo(self) -> str:
        """Return the current access tempo."""

        return self.ttg.access_window()

    def review_history(self) -> Tuple[Mapping[str, object], ...]:
        """Provide a tuple view of the recorded action history."""

        return tuple(self.ghostkey.replay_history())


if __name__ == "__main__":
    engine = EthicResonantTimeEngine(user_id="ghostkey316")
    engine.register_action({"type": "support"})
    engine.register_action({"type": "sacrifice"})
    engine.register_action({"type": "betrayal"})

    print("Current Access Tempo:", engine.current_tempo())
    print("Action History:", engine.review_history())
