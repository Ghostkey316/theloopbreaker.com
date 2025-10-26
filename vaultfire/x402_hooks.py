"""High-level helpers that wrap core Codex endpoints with x402 billing."""

from __future__ import annotations

from typing import Any, Mapping

from .x402_gateway import X402Gateway, get_default_gateway
from .x402_privacy import verify_x402_wallet

__all__ = [
    "trigger_belief_mirror",
    "run_passive_loop",
    "validate_loyalty_action",
]

_BASE_REWARD_MULTIPLIERS = {
    "ghostkey_multiplier": 3.16,
    "vaultfire_origin_tier": 1.0,
    "legacy_loyalty_tier": 1.0,
}


def _compose_reward_metadata(amount: float | None, wallet_classification: str) -> Mapping[str, Any]:
    reward_multipliers = dict(_BASE_REWARD_MULTIPLIERS)
    if wallet_classification == "ephemeral":
        reward_multipliers["ephemeral_wallet"] = 0.5
    multiplier = 1.0
    stack: list[Mapping[str, Any]] = []
    for key, value in reward_multipliers.items():
        multiplier *= value
        stack.append(
            {
                "key": key,
                "multiplier": value,
                "status": "active" if value != 1.0 else "tracked",
            }
        )
    final_yield = None if amount is None else round(amount * multiplier, 12)
    return {
        "base_amount": amount,
        "final_multiplier": round(multiplier, 6),
        "final_yield": final_yield,
        "stack": stack,
    }


def _gateway() -> X402Gateway:
    return get_default_gateway()


def _resolve_wallet(
    gateway: X402Gateway,
    *,
    wallet_address: str | None,
    belief_signal: Mapping[str, Any] | None,
    signature: str | None,
    wallet_type: str | None,
    error_message: str,
) -> tuple[str, str, str | None, Mapping[str, Any] | None, str | None]:
    wallet_address = wallet_address or gateway.identity_handle
    signature = signature or "codex::auto"
    verified, classification = verify_x402_wallet(
        wallet_address,
        belief_signal=belief_signal,
        signature=signature,
        wallet_type=wallet_type,
    )
    if not verified:
        raise PermissionError(error_message)
    return wallet_address, classification, signature, belief_signal, wallet_type


def trigger_belief_mirror(
    payload: Mapping[str, Any] | None = None,
    *,
    amount: float | None = None,
    currency: str | None = None,
    wallet_address: str | None = None,
    belief_signal: Mapping[str, Any] | None = None,
    signature: str | None = None,
    wallet_type: str | None = None,
) -> Mapping[str, Any]:
    """Wrap ``trigger_belief_mirror`` behaviour with x402 billing."""

    gateway = _gateway()
    (
        wallet_address,
        classification,
        signature,
        belief_signal,
        wallet_type,
    ) = _resolve_wallet(
        gateway,
        wallet_address=wallet_address,
        belief_signal=belief_signal,
        signature=signature,
        wallet_type=wallet_type,
        error_message="trigger_belief_mirror requires a verified wallet signal",
    )

    reward_meta = _compose_reward_metadata(amount, classification)

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
        wallet_address=wallet_address,
        belief_signal=belief_signal,
        signature=signature,
        wallet_type=wallet_type,
    )


def run_passive_loop(
    *,
    cycle: str = "default",
    amount: float | None = None,
    currency: str | None = None,
    metadata: Mapping[str, Any] | None = None,
    wallet_address: str | None = None,
    belief_signal: Mapping[str, Any] | None = None,
    signature: str | None = None,
    wallet_type: str | None = None,
) -> Mapping[str, Any]:
    """Execute a passive loop within the x402 billing context."""

    gateway = _gateway()
    (
        wallet_address,
        classification,
        signature,
        belief_signal,
        wallet_type,
    ) = _resolve_wallet(
        gateway,
        wallet_address=wallet_address,
        belief_signal=belief_signal,
        signature=signature,
        wallet_type=wallet_type,
        error_message="run_passive_loop requires a verified wallet signal",
    )

    payload = {"cycle": cycle, **dict(metadata or {})}

    reward_meta = _compose_reward_metadata(amount, classification)

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
        wallet_address=wallet_address,
        belief_signal=belief_signal,
        signature=signature,
        wallet_type=wallet_type,
    )


def validate_loyalty_action(
    action: str,
    *,
    signal_strength: float,
    amount: float | None = None,
    currency: str | None = None,
    metadata: Mapping[str, Any] | None = None,
    wallet_address: str | None = None,
    belief_signal: Mapping[str, Any] | None = None,
    signature: str | None = None,
    wallet_type: str | None = None,
) -> Mapping[str, Any]:
    """Confirm loyalty actions and record the outcome through x402."""

    gateway = _gateway()
    (
        wallet_address,
        classification,
        signature,
        belief_signal,
        wallet_type,
    ) = _resolve_wallet(
        gateway,
        wallet_address=wallet_address,
        belief_signal=belief_signal,
        signature=signature,
        wallet_type=wallet_type,
        error_message="validate_loyalty_action requires a verified wallet signal",
    )

    payload = {
        "action": action,
        "signal_strength": signal_strength,
        **dict(metadata or {}),
    }

    reward_meta = _compose_reward_metadata(amount, classification)

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
        wallet_address=wallet_address,
        belief_signal=belief_signal,
        signature=signature,
        wallet_type=wallet_type,
    )
