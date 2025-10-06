"""Partner sync handshake orchestration with stealth safeguards."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Mapping, MutableMapping, Optional
from uuid import uuid4

from vaultfire.mission import LedgerMetadata, MissionLedger
from vaultfire.security.fhe import Ciphertext, FHECipherSuite

_SUPPORTED_PROTOCOLS = frozenset({"ASM", "NS3", "VX-STEALTH"})


class PartnerSyncError(RuntimeError):
    """Raised when a partner sync handshake cannot be completed."""


def _normalize_wallet(wallet_id: str) -> str:
    if not isinstance(wallet_id, str):
        raise ValueError("wallet_id must be a string")
    candidate = wallet_id.strip()
    if not candidate:
        raise ValueError("wallet_id cannot be empty")
    return candidate.lower()


def _normalize_protocol(protocol: str, *, supported: Iterable[str]) -> str:
    if not isinstance(protocol, str):
        raise ValueError("partner_protocol must be a string")
    candidate = protocol.strip().upper()
    if not candidate:
        raise ValueError("partner_protocol cannot be empty")
    if candidate not in supported:
        raise PartnerSyncError(f"protocol {candidate} is not whitelisted")
    return candidate


def _normalize_chain(chain: str) -> str:
    if not isinstance(chain, str):
        raise ValueError("chain must be a string")
    candidate = chain.strip().lower()
    if candidate not in {"base", "ethereum", "zora"}:
        raise ValueError("chain must be base, ethereum, or zora")
    return candidate


def _hash_wallet(wallet_id: str) -> str:
    return hashlib.shake_256(wallet_id.encode("utf-8")).hexdigest(64)


def _fingerprint_ciphertext(ciphertext: Ciphertext) -> str:
    serialized = ciphertext.serialize()
    digest = hashlib.blake2b(
        repr(sorted(serialized.items())).encode("utf-8"), digest_size=32
    ).hexdigest()
    return digest


@dataclass(frozen=True)
class HandshakeRequest:
    """Input payload for initiating a partner sync handshake."""

    wallet_id: str
    partner_protocol: str
    signal_payload: Mapping[str, Any] = field(default_factory=dict)
    chain: str = "ethereum"
    mission_reference: Optional[str] = None
    nonce: Optional[str] = None


@dataclass(frozen=True)
class HandshakeResult:
    """Immutable representation of a completed handshake."""

    handshake_id: str
    wallet_commitment: str
    protocol: str
    chain: str
    zk_attestation: Mapping[str, Any]
    mpc_ciphertext: Ciphertext
    timestamp: str
    mission_reference: Optional[str]
    ledger_record_id: str

    def fingerprint(self) -> str:
        """Return a deterministic fingerprint for downstream registries."""

        return hashlib.blake2b(
            (
                self.handshake_id
                + self.wallet_commitment
                + self.protocol
                + self.chain
                + self.timestamp
            ).encode("utf-8"),
            digest_size=32,
        ).hexdigest()


class PartnerSyncEngine:
    """Coordinates stealth partner handshakes with MPC+zk guarantees."""

    def __init__(
        self,
        *,
        ledger: MissionLedger | None = None,
        cipher_suite: FHECipherSuite | None = None,
        supported_protocols: Iterable[str] | None = None,
    ) -> None:
        self._ledger = ledger or MissionLedger(component="vaultfire.partner.sync")
        self._cipher_suite = cipher_suite or FHECipherSuite()
        self._supported_protocols = frozenset(supported_protocols or _SUPPORTED_PROTOCOLS)
        self._sessions: MutableMapping[str, Mapping[str, Any]] = {}

    @property
    def supported_protocols(self) -> frozenset[str]:
        return frozenset(self._supported_protocols)

    def register_protocol(self, protocol: str) -> None:
        """Allow an additional protocol to complete handshakes."""

        normalized = protocol.strip().upper()
        if not normalized:
            raise ValueError("protocol cannot be empty")
        self._supported_protocols = frozenset(
            set(self._supported_protocols) | {normalized}
        )

    def initiate_handshake(self, request: HandshakeRequest) -> HandshakeResult:
        """Create a stealth handshake with zk+MPC attestations."""

        wallet = _normalize_wallet(request.wallet_id)
        protocol = _normalize_protocol(
            request.partner_protocol, supported=self._supported_protocols
        )
        chain = _normalize_chain(request.chain)
        nonce = request.nonce or secrets.token_hex(16)
        timestamp = datetime.now(timezone.utc).isoformat()

        wallet_commitment = _hash_wallet(wallet)
        payload_digest = {
            "wallet_commitment": wallet_commitment,
            "protocol": protocol,
            "nonce": nonce,
            "chain": chain,
            "timestamp": timestamp,
            "mission_reference": request.mission_reference,
            "signal_payload": dict(request.signal_payload),
        }

        ciphertext = self._cipher_suite.encrypt_record(
            payload_digest,
            sensitive_fields=("signal_payload", "wallet_commitment"),
        )
        zk_attestation = self._cipher_suite.generate_zero_knowledge_commitment(
            ciphertext,
            context=f"partner-sync::{protocol}::{chain}",
        )
        handshake_id = uuid4().hex
        record = self._ledger.append(
            category="partner-sync-handshake",
            payload={
                "handshake_id": handshake_id,
                "wallet_commitment": wallet_commitment,
                "protocol": protocol,
                "chain": chain,
                "nonce": nonce,
                "zk_attestation": zk_attestation,
                "mpc_fingerprint": _fingerprint_ciphertext(ciphertext),
                "mission_reference": request.mission_reference,
            },
            metadata=LedgerMetadata(
                partner_id=None,
                narrative="Stealth partner handshake",
                tags=("partner-sync", protocol.lower(), chain),
                extra={
                    "handshake_id": handshake_id,
                    "protocol": protocol,
                    "chain": chain,
                },
            ),
        )

        result = HandshakeResult(
            handshake_id=handshake_id,
            wallet_commitment=wallet_commitment,
            protocol=protocol,
            chain=chain,
            zk_attestation=zk_attestation,
            mpc_ciphertext=ciphertext,
            timestamp=timestamp,
            mission_reference=request.mission_reference,
            ledger_record_id=record.record_id,
        )
        self._sessions[handshake_id] = {
            "wallet_commitment": wallet_commitment,
            "protocol": protocol,
            "chain": chain,
            "nonce": nonce,
            "timestamp": timestamp,
            "zk_attestation": zk_attestation,
            "mpc_fingerprint": _fingerprint_ciphertext(ciphertext),
            "mission_reference": request.mission_reference,
        }
        return result

    def mirror_handshake(self, result: HandshakeResult, *, component: str) -> None:
        """Mirror an existing handshake into another mission component."""

        if result.handshake_id not in self._sessions:
            raise PartnerSyncError("handshake is not recognised")
        self._ledger.append(
            category="partner-sync-handshake-mirror",
            payload={
                "handshake_id": result.handshake_id,
                "component": component,
                "zk_attestation": result.zk_attestation,
                "mpc_fingerprint": _fingerprint_ciphertext(result.mpc_ciphertext),
            },
            metadata=LedgerMetadata(
                partner_id=None,
                narrative="Mirror handshake to mission component",
                tags=("partner-sync", component),
                extra={"handshake_id": result.handshake_id},
            ),
        )

    def verify_attestation(self, result: HandshakeResult) -> bool:
        """Validate that a handshake result matches the stored zk commitment."""

        session = self._sessions.get(result.handshake_id)
        if not session:
            return False
        if session["wallet_commitment"] != result.wallet_commitment:
            return False
        recalculated = self._cipher_suite.generate_zero_knowledge_commitment(
            result.mpc_ciphertext,
            context=f"partner-sync::{result.protocol}::{result.chain}",
        )
        return recalculated == result.zk_attestation


__all__ = [
    "HandshakeRequest",
    "HandshakeResult",
    "PartnerSyncEngine",
    "PartnerSyncError",
]
