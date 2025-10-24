"""High-level helpers that wrap core Codex endpoints with x402 billing."""

from __future__ import annotations

from typing import Any, Mapping

from .x402_gateway import X402Gateway, get_default_gateway

__all__ = [
    "trigger_belief_mirror",
    "run_passive_loop",
    "validate_loyalty_action",
]

_REWARD_MULTIPLIERS = {
    "ghostkey_multiplier": 3.16,
    "vaultfire_origin_tier": 1.0,
    "legacy_loyalty_tier": 1.0,
}


def _compose_reward_metadata(amount: float | None) -> Mapping[str, Any]:
    multiplier = 1.0
    stack: list[Mapping[str, Any]] = []
    for key, value in _REWARD_MULTIPLIERS.items():
        multiplier *= value
        stack.append({
            "key": key,
            "multiplier": value,
            "status": "active" if value != 1.0 else "tracked",
        })
    final_yield = None if amount is None else round(amount * multiplier, 12)
    return {
        "base_amount": amount,
        "final_multiplier": round(multiplier, 6),
        "final_yield": final_yield,
        "stack": stack,
    }


def _gateway() -> X402Gateway:
    return get_default_gateway()


def trigger_belief_mirror(
    payload: Mapping[str, Any] | None = None,
    *,
    amount: float | None = None,
    currency: str | None = None,
) -> Mapping[str, Any]:
    """Wrap ``trigger_belief_mirror`` behaviour with x402 billing."""

    gateway = _gateway()

    reward_meta = _compose_reward_metadata(amount)

    def _run() -> Mapping[str, Any]:
        return {
            "status": "ok",
            "endpoint": "trigger_belief_mirror",
            "payload": dict(payload or {}),
            "reward": reward_meta,
        }

    return gateway.execute(
        "codex.trigger_belief_mirror",
        _run,
        amount=amount,
        currency=currency,
        metadata={
            "payload": dict(payload or {}),
            "reward": reward_meta,
        },
    )


def run_passive_loop(
    *,
    cycle: str = "default",
    amount: float | None = None,
    currency: str | None = None,
    metadata: Mapping[str, Any] | None = None,
) -> Mapping[str, Any]:
    """Execute a passive loop within the x402 billing context."""

    gateway = _gateway()
    payload = {"cycle": cycle, **dict(metadata or {})}

    reward_meta = _compose_reward_metadata(amount)

    def _run() -> Mapping[str, Any]:
        return {
            "status": "ok",
            "endpoint": "run_passive_loop",
            "cycle": cycle,
            "metadata": dict(metadata or {}),
            "reward": reward_meta,
        }

    return gateway.execute(
        "codex.run_passive_loop",
        _run,
        amount=amount,
        currency=currency,
        metadata={**payload, "reward": reward_meta},
    )


def validate_loyalty_action(
    action: str,
    *,
    signal_strength: float,
    amount: float | None = None,
    currency: str | None = None,
    metadata: Mapping[str, Any] | None = None,
) -> Mapping[str, Any]:
    """Confirm loyalty actions and record the outcome through x402."""

    gateway = _gateway()
    payload = {
        "action": action,
        "signal_strength": signal_strength,
        **dict(metadata or {}),
    }

    reward_meta = _compose_reward_metadata(amount)

    def _run() -> Mapping[str, Any]:
        status = "validated" if signal_strength >= 0.5 else "review"
        return {
            "status": status,
            "endpoint": "validate_loyalty_action",
            "action": action,
            "signal_strength": signal_strength,
            "reward": reward_meta,
        }

    return gateway.execute(
        "codex.validate_loyalty_action",
        _run,
        amount=amount,
        currency=currency,
        metadata={**payload, "reward": reward_meta},
    )

