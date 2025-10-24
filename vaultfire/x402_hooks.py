"""High-level helpers that wrap core Codex endpoints with x402 billing."""

from __future__ import annotations

from typing import Any, Mapping

from .x402_gateway import X402Gateway, get_default_gateway

__all__ = [
    "trigger_belief_mirror",
    "run_passive_loop",
    "validate_loyalty_action",
]


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

    def _run() -> Mapping[str, Any]:
        return {
            "status": "ok",
            "endpoint": "trigger_belief_mirror",
            "payload": dict(payload or {}),
        }

    return gateway.execute(
        "codex.trigger_belief_mirror",
        _run,
        amount=amount,
        currency=currency,
        metadata={"payload": dict(payload or {})},
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

    def _run() -> Mapping[str, Any]:
        return {
            "status": "ok",
            "endpoint": "run_passive_loop",
            "cycle": cycle,
            "metadata": dict(metadata or {}),
        }

    return gateway.execute(
        "codex.run_passive_loop",
        _run,
        amount=amount,
        currency=currency,
        metadata=payload,
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

    def _run() -> Mapping[str, Any]:
        status = "validated" if signal_strength >= 0.5 else "review"
        return {
            "status": status,
            "endpoint": "validate_loyalty_action",
            "action": action,
            "signal_strength": signal_strength,
        }

    return gateway.execute(
        "codex.validate_loyalty_action",
        _run,
        amount=amount,
        currency=currency,
        metadata=payload,
    )

