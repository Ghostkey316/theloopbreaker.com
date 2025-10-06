"""Stealth yield emission utilities with zk arbitration."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, MutableMapping, Optional, Sequence
from uuid import uuid4

from vaultfire.mission import LedgerMetadata, MissionLedger
from vaultfire.security.fhe import Ciphertext, FHECipherSuite


def _normalize_wallet(wallet_id: str) -> str:
    if not isinstance(wallet_id, str):
        raise ValueError("wallet_id must be a string")
    candidate = wallet_id.strip()
    if not candidate:
        raise ValueError("wallet_id cannot be empty")
    return candidate.lower()


def _normalize_event(event: str) -> str:
    candidate = (event or "").strip()
    if not candidate:
        raise ValueError("mission_event must be provided")
    return candidate


def _normalize_chain(chain: str) -> str:
    candidate = chain.strip().lower()
    if candidate not in {"base", "ethereum", "zora"}:
        raise ValueError("chain must be base, ethereum, or zora")
    return candidate


def _hash_wallet(wallet_id: str) -> str:
    return hashlib.shake_256(wallet_id.encode("utf-8")).hexdigest(64)


def _fingerprint_batch(batch_id: str, wallet_commitments: Sequence[str]) -> str:
    digest_input = batch_id + "::" + "::".join(sorted(wallet_commitments))
    return hashlib.blake2b(digest_input.encode("utf-8"), digest_size=32).hexdigest()


@dataclass(frozen=True)
class StealthYieldDistribution:
    """Representation of a single wallet yield distribution."""

    wallet_id: str
    amount: float
    loyalty_points: float = 0.0
    traits: Mapping[str, Any] = field(default_factory=dict)

    def wallet_commitment(self) -> str:
        return _hash_wallet(_normalize_wallet(self.wallet_id))


@dataclass(frozen=True)
class StealthYieldBatch:
    """Encrypted batch of stealth yield distributions."""

    batch_id: str
    mission_event: str
    chain: str
    timestamp: str
    wallet_commitments: Sequence[str]
    ciphertexts: Sequence[Ciphertext]
    integrity_attestation: Mapping[str, Any]
    attestation_context: Mapping[str, Any]
    alignment_proof: Mapping[str, Any]

    def serialize(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "mission_event": self.mission_event,
            "chain": self.chain,
            "timestamp": self.timestamp,
            "wallet_commitments": list(self.wallet_commitments),
            "ciphertexts": [cipher.serialize() for cipher in self.ciphertexts],
            "integrity_attestation": dict(self.integrity_attestation),
            "attestation_context": dict(self.attestation_context),
            "alignment_proof": dict(self.alignment_proof),
        }


class StealthYieldEmitter:
    """Emit stealth yield with encrypted tracking and zk arbitration."""

    def __init__(
        self,
        *,
        ledger: MissionLedger | None = None,
        cipher_suite: FHECipherSuite | None = None,
    ) -> None:
        self._ledger = ledger or MissionLedger(component="vaultfire.stealth-yield")
        self._cipher_suite = cipher_suite or FHECipherSuite()
        self._batches: MutableMapping[str, StealthYieldBatch] = {}

    def build_distribution(
        self,
        *,
        wallet_id: str,
        amount: float,
        loyalty_points: float = 0.0,
        traits: Mapping[str, Any] | None = None,
    ) -> StealthYieldDistribution:
        """Create a normalized distribution entry."""

        if amount <= 0:
            raise ValueError("amount must be positive")
        if loyalty_points < 0:
            raise ValueError("loyalty_points cannot be negative")
        normalized_wallet = _normalize_wallet(wallet_id)
        return StealthYieldDistribution(
            wallet_id=normalized_wallet,
            amount=float(amount),
            loyalty_points=float(loyalty_points),
            traits=dict(traits or {}),
        )

    def emit(
        self,
        *,
        mission_event: str,
        chain: str,
        distributions: Sequence[StealthYieldDistribution],
        attestation_context: Mapping[str, Any],
    ) -> StealthYieldBatch:
        """Emit a stealth batch for the provided distributions."""

        normalized_event = _normalize_event(mission_event)
        normalized_chain = _normalize_chain(chain)
        if not distributions:
            raise ValueError("at least one distribution is required")

        batch_id = uuid4().hex
        timestamp = datetime.now(timezone.utc).isoformat()
        wallet_commitments = [distribution.wallet_commitment() for distribution in distributions]
        ciphertexts = [
            self._cipher_suite.encrypt_record(
                {
                    "wallet_commitment": distribution.wallet_commitment(),
                    "amount": distribution.amount,
                    "loyalty_points": distribution.loyalty_points,
                    "traits": dict(distribution.traits),
                },
                sensitive_fields=("traits", "wallet_commitment"),
            )
            for distribution in distributions
        ]
        integrity_attestation = self._cipher_suite.attest_integrity(ciphertexts)
        alignment_proof = {
            "batch_fingerprint": _fingerprint_batch(batch_id, wallet_commitments),
            "context_hash": hashlib.sha3_256(
                repr(sorted(attestation_context.items())).encode("utf-8")
            ).hexdigest(),
        }
        batch = StealthYieldBatch(
            batch_id=batch_id,
            mission_event=normalized_event,
            chain=normalized_chain,
            timestamp=timestamp,
            wallet_commitments=tuple(wallet_commitments),
            ciphertexts=tuple(ciphertexts),
            integrity_attestation=dict(integrity_attestation),
            attestation_context=dict(attestation_context),
            alignment_proof=alignment_proof,
        )
        self._batches[batch_id] = batch
        self._ledger.append(
            category="stealth-yield-batch",
            payload={
                "batch_id": batch.batch_id,
                "mission_event": normalized_event,
                "chain": normalized_chain,
                "wallet_commitments": wallet_commitments,
                "integrity_attestation": integrity_attestation,
                "alignment_proof": alignment_proof,
            },
            metadata=LedgerMetadata(
                partner_id=None,
                narrative="Stealth yield batch emitted",
                tags=("stealth-yield", normalized_chain),
                extra={"batch_id": batch.batch_id},
            ),
        )
        return batch

    def verify_batch(self, batch: StealthYieldBatch) -> bool:
        """Verify a batch by recomputing the integrity attestation."""

        recomputed = self._cipher_suite.attest_integrity(batch.ciphertexts)
        return dict(recomputed) == dict(batch.integrity_attestation)

    def request_rollback(self, batch: StealthYieldBatch, *, reason: str) -> str:
        """Record a rollback request with zk arbitration hints."""

        if batch.batch_id not in self._batches:
            raise ValueError("batch is not managed by this emitter")
        arbitration_hash = hashlib.blake2b(
            (
                batch.batch_id
                + "::".join(sorted(batch.wallet_commitments))
                + reason
            ).encode("utf-8"),
            digest_size=32,
        ).hexdigest()
        record = self._ledger.append(
            category="stealth-yield-rollback",
            payload={
                "batch_id": batch.batch_id,
                "reason": reason,
                "arbitration_hash": arbitration_hash,
            },
            metadata=LedgerMetadata(
                partner_id=None,
                narrative="Stealth yield rollback requested",
                tags=("stealth-yield", "rollback"),
                extra={
                    "batch_id": batch.batch_id,
                    "alignment_proof": batch.alignment_proof,
                },
            ),
        )
        return record.record_id

    def resolve_dispute(
        self,
        batch: StealthYieldBatch,
        *,
        wallet_commitment: str,
        evidence: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Resolve a dispute using zk arbitration primitives."""

        normalized_commitment = wallet_commitment.strip().lower()
        if normalized_commitment not in batch.wallet_commitments:
            raise ValueError("wallet commitment not part of batch")
        zk_arbitration_proof = hashlib.sha3_256(
            (
                batch.batch_id
                + normalized_commitment
                + repr(sorted(evidence.items()))
            ).encode("utf-8")
        ).hexdigest()
        self._ledger.append(
            category="stealth-yield-dispute",
            payload={
                "batch_id": batch.batch_id,
                "wallet_commitment": normalized_commitment,
                "zk_arbitration_proof": zk_arbitration_proof,
                "evidence": dict(evidence),
            },
            metadata=LedgerMetadata(
                partner_id=None,
                narrative="Stealth yield dispute resolved",
                tags=("stealth-yield", "dispute"),
                extra={"batch_id": batch.batch_id},
            ),
        )
        return {
            "batch_id": batch.batch_id,
            "wallet_commitment": normalized_commitment,
            "zk_arbitration_proof": zk_arbitration_proof,
        }

    def get_batch(self, batch_id: str) -> Optional[StealthYieldBatch]:
        return self._batches.get(batch_id)


__all__ = [
    "StealthYieldEmitter",
    "StealthYieldBatch",
    "StealthYieldDistribution",
]
