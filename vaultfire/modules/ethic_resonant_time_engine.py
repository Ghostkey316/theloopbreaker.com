"""Ethics-aware tempo engine for Vaultfire Ghostkey synchronization.

This module predates the new Vaultfire Protocol Stack but has now been
extended so the :class:`EthicResonantTimeEngine` can act as the temporal
anchor for the end-to-end integration requested by Ghostkey-316.  The
engine now keeps lightweight metadata describing its *First-of-its-Kind*
status, emits diagnostic payloads for the Ghostkey CLI, and mirrors quantum
hash pulses so the GiftMatrix and other modules can validate temporal
integrity.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Mapping, MutableSequence, Tuple

from vaultfire.quantum.hashmirror import QuantumHashMirror

from ._metadata import build_metadata, REQUIRED_TAGS


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
    """Coordinates moral scoring with Ghostkey synchronization.

    The engine acts as the canonical source of temporal ethics telemetry for
    the Vaultfire stack.  Each action updates the rolling moral momentum
    score and imprints a *quantum pulse* string so downstream modules can
    validate that the timeline has not been tampered with.  The metadata flag
    ``first_of_its_kind`` is surfaced to the CLI so the user can confirm the
    protocol uniqueness requirement from the prompt.
    """

    def __init__(
        self,
        user_id: str,
        *,
        identity_handle: str = "bpow20.cb.id",
        identity_ens: str = "ghostkey316.eth",
    ) -> None:
        self.mmi = MoralMomentumIndex()
        self.ttg = TemporalTrustGate(self.mmi)
        self.ghostkey = GhostkeySyncEngine(user_id)
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.metadata: Mapping[str, object] = build_metadata(
            "EthicResonantTimeEngine",
            identity={
                "wallet": identity_handle,
                "ens": identity_ens,
                "user_id": user_id,
            },
        )
        self._quantum_mirror = QuantumHashMirror(
            seed=f"ethic-resonant-time::{user_id}"
        )
        self._pulse_log: MutableSequence[Mapping[str, object]] = []

    def register_action(self, action: Mapping[str, object]) -> None:
        """Register an action with both Ghostkey sync and moral index."""

        timestamp = datetime.now(timezone.utc)
        payload = dict(action)
        payload.setdefault("timestamp", timestamp.isoformat())
        self.ghostkey.log_event(payload)
        self.mmi.update(payload)
        tempo = self.ttg.access_window()
        integrity = self._integrity_from_action(payload)
        interaction_ref = str(
            payload.get("interaction_id") or payload.get("timestamp") or f"tempo::{len(self._pulse_log)+1}"
        )
        pulse = self._quantum_mirror.imprint(
            self.identity_ens,
            interaction_id=interaction_ref,
            branch=tempo,
            payload={
                "integrity": integrity,
                "timestamp": payload.get("timestamp"),
                "action": payload.get("type"),
                "weight": payload.get("weight", 0),
            },
        )
        self._pulse_log.append(
            {
                "tempo": tempo,
                "integrity": integrity,
                "timestamp": payload.get("timestamp"),
                "pulse": pulse,
            }
        )

    def _integrity_from_action(self, action: Mapping[str, object]) -> float:
        action_type = str(action.get("type", "")).lower()
        weight = float(action.get("weight", 1.0))
        if action_type in {"support", "sacrifice", "uplift"}:
            return min(1.0, 0.8 + abs(weight) * 0.05)
        if action_type in {"selfish", "betrayal"}:
            return max(0.0, 0.6 - abs(weight) * 0.05)
        return 0.7

    def current_tempo(self) -> str:
        """Return the current access tempo."""

        return self.ttg.access_window()

    def review_history(self) -> Tuple[Mapping[str, object], ...]:
        """Provide a tuple view of the recorded action history."""

        return tuple(self.ghostkey.replay_history())

    def timecheck(self) -> Mapping[str, object]:
        """Return a diagnostic payload consumed by the CLI."""

        return {
            "identity": self.metadata["identity"],
            "tempo": self.current_tempo(),
            "moral_score": self.mmi.get_score(),
            "history": list(self.review_history()),
            "pulse_integrity": self._pulse_log[-1]["integrity"] if self._pulse_log else 0.0,
            "metadata": self.metadata,
        }

    def pulse(self) -> Mapping[str, object]:
        """Expose the latest quantum pulse and tempo status."""

        latest = self._pulse_log[-1] if self._pulse_log else {}
        if latest:
            tempo = latest.get("tempo", self.current_tempo())
            pulse_value = latest.get("pulse")
            integrity = latest.get("integrity", 0.0)
        else:
            tempo = self.current_tempo()
            pulse_value = self._quantum_mirror.imprint(
                self.identity_ens,
                interaction_id="initial",
                branch=tempo,
                payload={"generated": True},
            )
            integrity = 0.0
        return {
            "tempo": tempo,
            "pulse": pulse_value,
            "integrity": integrity,
            "metadata": self.metadata,
        }


if __name__ == "__main__":
    engine = EthicResonantTimeEngine(user_id="ghostkey316")
    engine.register_action({"type": "support"})
    engine.register_action({"type": "sacrifice"})
    engine.register_action({"type": "betrayal"})

    print("Current Access Tempo:", engine.current_tempo())
    print("Action History:", engine.review_history())
