"""Behavior engine coordination utilities for Vaultfire systems.

The :func:`optimize_behavior_engine` helper provides a single entry point
for configuring the behavioral runtime for a Vaultfire deployment.  The
function validates inputs, normalises the requested behaviour, and records
the outcome in a thread-safe module state so that other components can
query the active configuration.

All settings are grounded in the Ghostkey ethics framework and emphasise
auditable, human-centred feedback loops.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from types import MappingProxyType
from typing import Mapping, MutableMapping

__all__ = [
    "BehaviorEngineState",
    "get_behavior_engine_state",
    "optimize_behavior_engine",
    "reset_behavior_engine_state",
]

_ALLOWED_MEMORY_RETENTION = {
    "ephemeral",
    "session",
    "standard",
    "extended",
    "permanent",
}
_ALLOWED_FEEDBACK_LOOPS = {
    "passive",
    "interactive",
    "hybrid",
    "synchronous",
}

_EMPTY_METADATA: Mapping[str, object] = MappingProxyType({})
_EPOCH = datetime.fromtimestamp(0, tz=timezone.utc)


def _empty_metadata() -> Mapping[str, object]:
    return _EMPTY_METADATA


@dataclass(frozen=True)
class BehaviorEngineState:
    """Immutable snapshot of the current behaviour engine configuration."""

    user_id: str
    wallet: str
    autotune_enabled: bool
    sync_learning_rate: float
    memory_retention: str
    feedback_loop: str
    ethics_core: str
    last_updated: datetime
    metadata: Mapping[str, object] = field(default_factory=_empty_metadata)

    def as_payload(self) -> dict[str, object]:
        """Return a serialisable representation of the state."""

        payload: dict[str, object] = {
            "user_id": self.user_id,
            "wallet": self.wallet,
            "autotune_enabled": self.autotune_enabled,
            "sync_learning_rate": self.sync_learning_rate,
            "memory_retention": self.memory_retention,
            "feedback_loop": self.feedback_loop,
            "ethics_core": self.ethics_core,
            "last_updated": self.last_updated.isoformat(),
        }
        if self.metadata:
            payload["metadata"] = dict(self.metadata)
        return payload


_STATE_LOCK = Lock()


def _freeze_metadata(metadata: MutableMapping[str, object] | None) -> Mapping[str, object]:
    if not metadata:
        return _EMPTY_METADATA
    return MappingProxyType(dict(metadata))


def _normalise_identifier(value: str, *, field: str) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{field} must be a string")
    normalised = value.strip()
    if not normalised:
        raise ValueError(f"{field} must be a non-empty string")
    return normalised


def _normalise_learning_rate(value: float) -> float:
    try:
        learning_rate = float(value)
    except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
        raise TypeError("sync_learning_rate must be a floating point number") from exc
    if learning_rate <= 0:
        raise ValueError("sync_learning_rate must be greater than zero")
    return learning_rate


def _normalise_choice(value: str, *, field: str, allowed: set[str]) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{field} must be a string")
    candidate = value.strip().lower().replace(" ", "_")
    if candidate not in allowed:
        allowed_values = ", ".join(sorted(allowed))
        raise ValueError(f"{field} must be one of: {allowed_values}")
    return candidate


def _normalise_ethics_core(value: str) -> str:
    if not isinstance(value, str):
        raise TypeError("ethics_core must be a string")
    normalised = value.strip()
    if not normalised:
        raise ValueError("ethics_core must be a non-empty string")
    return normalised


def _default_state() -> BehaviorEngineState:
    return BehaviorEngineState(
        user_id="anonymous",
        wallet="",
        autotune_enabled=False,
        sync_learning_rate=1.0,
        memory_retention="standard",
        feedback_loop="passive",
        ethics_core="Ghostkey Ethics Framework v1.0",
        last_updated=_EPOCH,
        metadata=_freeze_metadata(
            {
                "autotune": "disabled",
                "feedback_loop": "passive",
                "memory_retention": "standard",
            }
        ),
    )


_STATE = _default_state()


def get_behavior_engine_state() -> BehaviorEngineState:
    """Return the current behaviour engine configuration."""

    with _STATE_LOCK:
        return _STATE


def reset_behavior_engine_state() -> None:
    """Reset the behaviour engine configuration to its defaults."""

    global _STATE
    with _STATE_LOCK:
        _STATE = _default_state()


def optimize_behavior_engine(
    *,
    user_id: str,
    wallet: str,
    enable_autotune: bool,
    sync_learning_rate: float,
    memory_retention: str,
    feedback_loop: str,
    ethics_core: str,
) -> BehaviorEngineState:
    """Optimise the behaviour engine for a given identity and wallet."""

    if not isinstance(enable_autotune, bool):
        raise TypeError("enable_autotune must be a boolean value")

    normalised_user = _normalise_identifier(user_id, field="user_id")
    normalised_wallet = _normalise_identifier(wallet, field="wallet")
    normalised_rate = _normalise_learning_rate(sync_learning_rate)
    normalised_retention = _normalise_choice(
        memory_retention,
        field="memory_retention",
        allowed=_ALLOWED_MEMORY_RETENTION,
    )
    normalised_feedback = _normalise_choice(
        feedback_loop,
        field="feedback_loop",
        allowed=_ALLOWED_FEEDBACK_LOOPS,
    )
    normalised_ethics = _normalise_ethics_core(ethics_core)

    metadata: MutableMapping[str, object] = {
        "autotune": "enabled" if enable_autotune else "disabled",
        "feedback_loop": normalised_feedback,
        "memory_retention": normalised_retention,
    }
    if enable_autotune:
        metadata["sync_profile"] = {
            "learning_rate": normalised_rate,
            "stability_coefficient": round(min(normalised_rate / 2.0, 1.0), 3),
        }

    state = BehaviorEngineState(
        user_id=normalised_user,
        wallet=normalised_wallet,
        autotune_enabled=enable_autotune,
        sync_learning_rate=normalised_rate,
        memory_retention=normalised_retention,
        feedback_loop=normalised_feedback,
        ethics_core=normalised_ethics,
        last_updated=datetime.now(timezone.utc),
        metadata=_freeze_metadata(metadata),
    )

    global _STATE
    with _STATE_LOCK:
        _STATE = state
    return state

