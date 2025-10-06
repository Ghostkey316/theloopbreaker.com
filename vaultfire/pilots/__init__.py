"""Pilot deployment helpers for Vaultfire secret test nodes."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Literal, Sequence, Tuple

__all__ = [
    "SecretTestNodeDeployment",
    "deploy_secret_test_node",
]

Visibility = Literal["stealth", "obscured", "public"]
NodeStatus = Literal["live", "pilot", "dormant", "retired"]

_VISIBILITY_OPTIONS: Tuple[Visibility, ...] = ("stealth", "obscured", "public")
_STATUS_OPTIONS: Tuple[NodeStatus, ...] = ("live", "pilot", "dormant", "retired")


@dataclass(frozen=True)
class SecretTestNodeDeployment:
    """Structured representation of a secret test node deployment."""

    node_name: str
    wallet: str
    visibility: Visibility
    status: NodeStatus
    eligible_partners: Tuple[str, ...]
    return_feedback: bool
    yield_tied: bool
    handshake_token: str
    issued_at: str


def _normalize_partners(partners: Iterable[str]) -> Tuple[str, ...]:
    """Return unique partner names preserving order and validating content."""

    normalized: list[str] = []
    seen: set[str] = set()
    for partner in partners:
        if not isinstance(partner, str):
            raise TypeError("Eligible partners must be provided as strings")
        trimmed = partner.strip()
        if not trimmed:
            raise ValueError("Eligible partner names cannot be blank")
        key = trimmed.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(trimmed)

    if not normalized:
        raise ValueError("At least one eligible partner must be provided")

    return tuple(normalized)


def _generate_handshake_token(*, node_name: str, wallet: str, visibility: Visibility, status: NodeStatus, partners: Tuple[str, ...], return_feedback: bool, yield_tied: bool) -> str:
    """Generate a deterministic handshake token for the deployment."""

    payload = "|".join(
        (
            node_name,
            wallet,
            visibility,
            status,
            ",".join(partners),
            "feedback-on" if return_feedback else "feedback-off",
            "yield-tied" if yield_tied else "yield-untied",
        )
    )
    digest = hashlib.blake2s(payload.encode("utf-8"), digest_size=12)
    return digest.hexdigest()


def deploy_secret_test_node(
    *,
    node_name: str,
    wallet: str,
    visibility: Visibility,
    status: NodeStatus,
    eligible_partners: Sequence[str],
    return_feedback: bool,
    yield_tied: bool,
) -> SecretTestNodeDeployment:
    """Validate inputs and return a deployment summary for a secret test node."""

    if not isinstance(node_name, str) or not node_name.strip():
        raise ValueError("node_name must be a non-empty string")
    if not isinstance(wallet, str) or not wallet.strip():
        raise ValueError("wallet must be a non-empty string")

    if visibility not in _VISIBILITY_OPTIONS:
        raise ValueError(f"Unsupported visibility level: {visibility}")
    if status not in _STATUS_OPTIONS:
        raise ValueError(f"Unsupported node status: {status}")

    partners = _normalize_partners(eligible_partners)

    handshake_token = _generate_handshake_token(
        node_name=node_name.strip(),
        wallet=wallet.strip(),
        visibility=visibility,
        status=status,
        partners=partners,
        return_feedback=return_feedback,
        yield_tied=yield_tied,
    )

    issued_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    return SecretTestNodeDeployment(
        node_name=node_name.strip(),
        wallet=wallet.strip(),
        visibility=visibility,
        status=status,
        eligible_partners=partners,
        return_feedback=return_feedback,
        yield_tied=yield_tied,
        handshake_token=handshake_token,
        issued_at=issued_at,
    )
