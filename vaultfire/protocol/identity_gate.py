"""Biometric and ZK identity integrations for yield gating.""" 

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Mapping, MutableMapping

from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID


@dataclass(slots=True)
class ZKIdentityRecord:
    wallet: str
    verified: bool
    provider: str
    proof_hash: str


class ZKIdentityVerifier:
    """Simple registry backed verifier compatible with Worldcoin/ZK-ID."""

    def __init__(self, *, registry: Mapping[str, Mapping[str, str]]) -> None:
        self._registry = {key.lower(): dict(value) for key, value in registry.items()}

    def verified(self, wallet: str) -> bool:
        if not wallet:
            return False
        record = self._registry.get(wallet.lower())
        return bool(record and record.get("status") == "verified")

    def get_record(self, wallet: str) -> ZKIdentityRecord | None:
        record = self._registry.get(wallet.lower())
        if not record:
            return None
        return ZKIdentityRecord(
            wallet=wallet,
            verified=record.get("status") == "verified",
            provider=record.get("provider", "unknown"),
            proof_hash=record.get("proof_hash", ""),
        )


class BiometricYieldRouter:
    """Routes yield events only when biometric/zk identity requirements pass."""

    def __init__(self, *, verifier: ZKIdentityVerifier) -> None:
        self._verifier = verifier
        self._yield_events: MutableMapping[str, Dict[str, str]] = {}
        self.architect_wallet = ARCHITECT_WALLET
        self.origin_node = ORIGIN_NODE_ID

    def yield_drop(self, wallet: str, *, drop_id: str) -> Dict[str, str]:
        if not self._verifier.verified(wallet):
            raise PermissionError("identity verification required for biometric gated yield")
        event = {
            "wallet": wallet,
            "drop_id": drop_id,
            "architect_wallet": self.architect_wallet,
            "origin_node": self.origin_node,
        }
        self._yield_events[wallet] = event
        return event

    def last_event(self, wallet: str) -> Dict[str, str] | None:
        return self._yield_events.get(wallet)


__all__ = ["ZKIdentityVerifier", "BiometricYieldRouter", "ZKIdentityRecord"]
