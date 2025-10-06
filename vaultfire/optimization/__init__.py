"""Runtime optimization utilities for Vaultfire deployments."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Iterable, Tuple

__all__ = [
    "enhance_protocol_speed",
    "improve_logic_routing",
    "enable_coin_cross_compatibility",
    "increase_yield_capture",
    "upgrade_error_resilience",
    "get_optimization_state",
    "reset_optimization_state",
]

_ALLOWED_SPEED_LEVELS = {"baseline", "balanced", "high", "max"}
_ALLOWED_ROUTING_DEPTHS = {"shallow", "standard", "deep", "ultra"}
_ALLOWED_RESILIENCE_METHODS = {"baseline", "auto-recovery", "redundant", "distributed"}


@dataclass
class OptimizationState:
    """Track the current optimization settings applied to Vaultfire."""

    protocol_speed: str = "balanced"
    logic_depth: str = "standard"
    cross_compatible: bool = False
    supported_coins: Tuple[str, ...] = field(default_factory=tuple)
    yield_multiplier: float = 1.0
    error_resilience: str = "baseline"

    def snapshot(self) -> dict[str, object]:
        """Return a representation of the current state."""

        return {
            "protocol_speed": self.protocol_speed,
            "logic_depth": self.logic_depth,
            "cross_compatible": self.cross_compatible,
            "supported_coins": tuple(self.supported_coins),
            "yield_multiplier": self.yield_multiplier,
            "error_resilience": self.error_resilience,
        }


_state = OptimizationState()
_state_lock = threading.Lock()


def _update_state(**updates: object) -> OptimizationState:
    with _state_lock:
        for key, value in updates.items():
            setattr(_state, key, value)
        return OptimizationState(**_state.snapshot())


def get_optimization_state() -> OptimizationState:
    """Return a copy of the current optimization state."""

    with _state_lock:
        return OptimizationState(**_state.snapshot())


def reset_optimization_state() -> None:
    """Reset the optimization state to its defaults."""

    with _state_lock:
        global _state
        _state = OptimizationState()


def enhance_protocol_speed(*, level: str = "balanced") -> OptimizationState:
    """Increase the protocol speed to the requested level.

    Args:
        level: One of ``baseline``, ``balanced``, ``high``, or ``max``.

    Returns:
        A copy of the updated :class:`OptimizationState`.

    Raises:
        ValueError: If ``level`` is not recognised.
    """

    normalized = level.strip().lower()
    if normalized not in _ALLOWED_SPEED_LEVELS:
        raise ValueError(f"Unknown protocol speed level: {level!r}")
    return _update_state(protocol_speed=normalized)


def improve_logic_routing(*, depth: str = "standard") -> OptimizationState:
    """Tune the logic routing depth."""

    normalized = depth.strip().lower()
    if normalized not in _ALLOWED_ROUTING_DEPTHS:
        raise ValueError(f"Unknown logic routing depth: {depth!r}")
    return _update_state(logic_depth=normalized)


def enable_coin_cross_compatibility(
    *, include_all: bool = False, coins: Iterable[str] | None = None
) -> OptimizationState:
    """Activate coin interoperability across Vaultfire surfaces.

    Args:
        include_all: When ``True`` the engine will mark all coins as supported.
        coins: Specific coin identifiers to allow when ``include_all`` is ``False``.

    Returns:
        A copy of the updated :class:`OptimizationState`.

    Raises:
        ValueError: If no coins are provided when ``include_all`` is ``False``.
    """

    normalized_coins: Tuple[str, ...]
    if include_all:
        normalized_coins = ("*",)
    else:
        if coins is None:
            raise ValueError("coins must be provided when include_all is False")
        unique = {coin.strip().upper() for coin in coins if coin and coin.strip()}
        if not unique:
            raise ValueError("coins must contain at least one non-empty identifier")
        normalized_coins = tuple(sorted(unique))

    return _update_state(
        cross_compatible=True,
        supported_coins=normalized_coins,
    )


def increase_yield_capture(*, multiplier: float = 1.0) -> OptimizationState:
    """Adjust the expected yield multiplier for the protocol."""

    if multiplier <= 0:
        raise ValueError("multiplier must be greater than zero")
    return _update_state(yield_multiplier=float(multiplier))


def upgrade_error_resilience(*, method: str = "baseline") -> OptimizationState:
    """Select an error recovery strategy."""

    normalized = method.strip().lower()
    if normalized not in _ALLOWED_RESILIENCE_METHODS:
        raise ValueError(f"Unknown error resilience method: {method!r}")
    return _update_state(error_resilience=normalized)
