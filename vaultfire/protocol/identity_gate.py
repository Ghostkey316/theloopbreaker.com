"""Biometric and ZK identity integrations for yield gating."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable, Dict, Iterable, Mapping, MutableMapping, Sequence

from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID


@dataclass(slots=True)
class ZKIdentityRecord:
    wallet: str
    verified: bool
    provider: str
    proof_hash: str


class ZKIdentityVerifier:
    """Registry + live attestation backed verifier compatible with ZK-ID feeds."""

    def __init__(
        self,
        *,
        registry: Mapping[str, Mapping[str, str]],
        attestors: Iterable[Mapping[str, str]] | None = None,
    ) -> None:
        self._registry = {key.lower(): dict(value) for key, value in registry.items()}
        self._audit_trail: list[Dict[str, str]] = []
        if attestors:
            self.ingest_attestations(attestors, source="bootstrap")

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

    def ingest_attestations(
        self,
        records: Iterable[Mapping[str, str]],
        *,
        source: str = "external",
    ) -> None:
        timestamp = time.time()
        for record in records:
            wallet = str(record.get("wallet", "")).strip().lower()
            if not wallet:
                continue
            status = record.get("status", "verified")
            provider = record.get("provider", record.get("source", "unknown"))
            proof_hash = record.get("proof_hash", record.get("proof", ""))
            self._registry[wallet] = {
                "status": status,
                "provider": provider,
                "proof_hash": proof_hash,
            }
            self._audit_trail.append(
                {
                    "wallet": wallet,
                    "status": status,
                    "provider": provider,
                    "source": source,
                    "proof_hash": proof_hash,
                    "timestamp": timestamp,
                }
            )

    def refresh_from_feed(
        self,
        feed: Iterable[Mapping[str, str]] | Callable[[], Sequence[Mapping[str, str]]],
        *,
        source: str = "live-sync",
    ) -> int:
        records = feed() if callable(feed) else feed
        before = len(self._audit_trail)
        self.ingest_attestations(records, source=source)
        return len(self._audit_trail) - before

    @property
    def audit_trail(self) -> Sequence[Dict[str, str]]:
        return tuple(self._audit_trail)

    def pending_wallets(self) -> Sequence[str]:
        return tuple(wallet for wallet, record in self._registry.items() if record.get("status") != "verified")


class BiometricYieldRouter:
    """Routes yield events only when biometric/zk identity requirements pass."""

    def __init__(self, *, verifier: ZKIdentityVerifier) -> None:
        self._verifier = verifier
        self._yield_events: MutableMapping[str, Dict[str, str]] = {}
        self._audit_log: list[Dict[str, str]] = []
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
            "timestamp": time.time(),
        }
        self._yield_events[wallet] = event
        self._audit_log.append(event)
        return event

    def last_event(self, wallet: str) -> Dict[str, str] | None:
        return self._yield_events.get(wallet)

    def sync_identity_feed(
        self,
        feed: Iterable[Mapping[str, str]] | Callable[[], Sequence[Mapping[str, str]]],
        *,
        source: str = "live-sync",
    ) -> int:
        return self._verifier.refresh_from_feed(feed, source=source)

    @property
    def audit_log(self) -> Sequence[Dict[str, str]]:
        return tuple(self._audit_log)


__all__ = ["ZKIdentityVerifier", "BiometricYieldRouter", "ZKIdentityRecord"]
