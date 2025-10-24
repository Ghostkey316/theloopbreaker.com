"""Access guardrails for suspicious wallet activity.

This module adds a focused helper that can be reused by HTTP services or
background monitors that already track request cadence per wallet.  The helper
expects a verification adapter that exposes a ``verified`` method (compatible
with :class:`vaultfire.protocol.identity_gate.ZKIdentityVerifier`) and a
``ban_user`` callable supplied by the caller.  The callable is triggered only
when the wallet is not verified and the observed access rate exceeds the
allowed ceiling for untrusted traffic.

The policy is intentionally conservative—verified wallets are never banned by
this guard and negative rates are rejected early so upstream bugs are surfaced
quickly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class WalletVerifier(Protocol):
    """Minimal protocol for wallet verification lookups."""

    def verified(self, wallet: str) -> bool:  # pragma: no cover - protocol stub
        """Return ``True`` when ``wallet`` is verified."""


class BanAction(Protocol):
    """Protocol for ban callbacks."""

    def __call__(self, reason: str) -> None:  # pragma: no cover - protocol stub
        """Ban the current wallet for ``reason``."""


@dataclass(frozen=True)
class AccessDecision:
    """Outcome of an access rate evaluation."""

    wallet: str
    access_rate: float
    verified: bool
    status: str
    reason: str | None = None


MAX_UNVERIFIED_RATE_PER_MINUTE = 15


def evaluate_access_rate(
    wallet: str,
    access_rate_per_minute: float,
    *,
    verifier: WalletVerifier,
    ban_user: BanAction,
    max_unverified_rate: float = MAX_UNVERIFIED_RATE_PER_MINUTE,
) -> AccessDecision:
    """Evaluate wallet access cadence and trigger a ban when warranted.

    Parameters
    ----------
    wallet:
        Wallet identifier being evaluated.  The value is normalised to
        lower-case to match how verification registries store identifiers.
    access_rate_per_minute:
        Observed request rate in the last rolling minute.
    verifier:
        Object capable of reporting whether the wallet is verified.
    ban_user:
        Callback executed when the wallet should be banned.
    max_unverified_rate:
        Maximum allowed access rate for unverified wallets.  The default mirrors
        the policy requested by security operations.

    Returns
    -------
    AccessDecision
        Dataclass describing the resulting action.

    Raises
    ------
    ValueError
        If ``wallet`` is empty or if the supplied rate is negative.
    """

    if not wallet or not wallet.strip():
        raise ValueError("wallet identifier is required")
    if access_rate_per_minute < 0:
        raise ValueError("access rate cannot be negative")

    normalized_wallet = wallet.strip().lower()
    is_verified = bool(verifier.verified(normalized_wallet))

    if not is_verified and access_rate_per_minute > max_unverified_rate:
        ban_user("ghost_attempt_detected")
        return AccessDecision(
            wallet=normalized_wallet,
            access_rate=access_rate_per_minute,
            verified=False,
            status="banned",
            reason="ghost_attempt_detected",
        )

    return AccessDecision(
        wallet=normalized_wallet,
        access_rate=access_rate_per_minute,
        verified=is_verified,
        status="allowed",
        reason=None,
    )


__all__ = [
    "AccessDecision",
    "evaluate_access_rate",
    "MAX_UNVERIFIED_RATE_PER_MINUTE",
]

