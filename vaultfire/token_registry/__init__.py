"""Vaultfire Token Registry (VTR) with stealth yield coordination."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, MutableMapping, Optional, Sequence, TYPE_CHECKING
from uuid import uuid4

from vaultfire.mission import LedgerMetadata, MissionLedger
from vaultfire.partner.sync import HandshakeResult
from vaultfire.security.fhe import Ciphertext, FHECipherSuite

if TYPE_CHECKING:  # pragma: no cover - for type checking only
    import importlib

    _stealth_module = importlib.import_module("vaultfire.yield.stealth_emitter")
    StealthYieldBatch = _stealth_module.StealthYieldBatch
    StealthYieldDistribution = _stealth_module.StealthYieldDistribution
    StealthYieldEmitter = _stealth_module.StealthYieldEmitter
else:  # pragma: no cover - runtime fallbacks for typing only names
    StealthYieldBatch = Any  # type: ignore[assignment]
    StealthYieldDistribution = Any  # type: ignore[assignment]
    StealthYieldEmitter = Any  # type: ignore[assignment]

_SUPPORTED_CHAINS = ("base", "ethereum", "zora")


def _normalize_wallet(wallet_id: str) -> str:
    if not isinstance(wallet_id, str):
        raise ValueError("wallet_id must be a string")
    candidate = wallet_id.strip()
    if not candidate:
        raise ValueError("wallet_id cannot be empty")
    return candidate.lower()


def _normalize_chain(chain: str) -> str:
    normalized = chain.strip().lower()
    if normalized not in _SUPPORTED_CHAINS:
        raise ValueError("Unsupported chain for token registry")
    return normalized


def _shake_commitment(value: str) -> str:
    digest = hashlib.shake_256(value.encode("utf-8"))
    return digest.hexdigest(64)


def _ledger_tags(chain: str, signal_type: str) -> Sequence[str]:
    return ("token-registry", chain, signal_type)


@dataclass(frozen=True)
class WalletRegistration:
    """Immutable snapshot of a registered wallet commitment."""

    wallet_id: str
    chain: str
    commitment: str
    registered_at: str
    traits: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class TokenRegistryRecord:
    """Record produced when mapping a yield or loyalty signal."""

    record_id: str
    wallet_commitment: str
    chain: str
    signal_type: str
    ciphertext: Ciphertext
    attestation: Mapping[str, Any]
    handshake_fingerprint: str
    created_at: str


class VaultfireTokenRegistry:
    """Registry linking partner signals to wallets with stealth security."""

    def __init__(
        self,
        *,
        ledger: MissionLedger | None = None,
        cipher_suite: FHECipherSuite | None = None,
        supported_chains: Sequence[str] | None = None,
    ) -> None:
        self._ledger = ledger or MissionLedger(component="vaultfire.token-registry")
        self._cipher_suite = cipher_suite or FHECipherSuite()
        chains = tuple((_SUPPORTED_CHAINS if supported_chains is None else supported_chains))
        normalized = {_normalize_chain(chain) for chain in chains}
        self._supported_chains = tuple(sorted(normalized))
        self._registry: MutableMapping[str, WalletRegistration] = {}

    @property
    def supported_chains(self) -> Sequence[str]:
        return self._supported_chains

    def register_wallet(
        self,
        wallet_id: str,
        *,
        chain: str,
        traits: Mapping[str, Any] | None = None,
    ) -> WalletRegistration:
        """Register a wallet commitment for stealth tracking."""

        normalized_wallet = _normalize_wallet(wallet_id)
        normalized_chain = _normalize_chain(chain)
        if normalized_chain not in self._supported_chains:
            raise ValueError("Chain not enabled in this registry")
        commitment = _shake_commitment(normalized_wallet)
        timestamp = datetime.now(timezone.utc).isoformat()
        registration = WalletRegistration(
            wallet_id=normalized_wallet,
            chain=normalized_chain,
            commitment=commitment,
            registered_at=timestamp,
            traits=dict(traits or {}),
        )
        self._registry[f"{normalized_chain}:{commitment}"] = registration
        self._ledger.append(
            category="token-registry-registration",
            payload={
                "wallet_commitment": commitment,
                "chain": normalized_chain,
                "traits": dict(traits or {}),
                "registration_id": uuid4().hex,
            },
            metadata=LedgerMetadata(
                partner_id=None,
                narrative="Wallet registered for stealth yield tracking",
                tags=("token-registry", normalized_chain),
                extra={"commitment": commitment},
            ),
        )
        return registration

    def is_wallet_registered(self, wallet_id: str, *, chain: str) -> bool:
        normalized_chain = _normalize_chain(chain)
        normalized_wallet = _normalize_wallet(wallet_id)
        commitment = _shake_commitment(normalized_wallet)
        return f"{normalized_chain}:{commitment}" in self._registry

    def map_yield_signal(
        self,
        *,
        wallet_id: str,
        chain: str,
        signal_type: str,
        payload: Mapping[str, Any],
        handshake: HandshakeResult,
    ) -> TokenRegistryRecord:
        """Map a yield or loyalty signal to a registered wallet."""

        normalized_chain = _normalize_chain(chain)
        normalized_wallet = _normalize_wallet(wallet_id)
        commitment = _shake_commitment(normalized_wallet)
        if f"{normalized_chain}:{commitment}" not in self._registry:
            raise ValueError("wallet must be registered before mapping signals")

        ciphertext = self._cipher_suite.encrypt_record(
            {
                "wallet_commitment": commitment,
                "signal_type": signal_type,
                "payload": dict(payload),
                "handshake_fingerprint": handshake.fingerprint(),
            },
            sensitive_fields=("payload", "wallet_commitment"),
        )
        attestation = self._cipher_suite.generate_zero_knowledge_commitment(
            ciphertext,
            context=f"token-registry::{signal_type}::{normalized_chain}",
        )
        timestamp = datetime.now(timezone.utc).isoformat()
        record_id = uuid4().hex
        self._ledger.append(
            category="token-registry-signal",
            payload={
                "record_id": record_id,
                "wallet_commitment": commitment,
                "chain": normalized_chain,
                "signal_type": signal_type,
                "handshake_id": handshake.handshake_id,
                "attestation": attestation,
            },
            metadata=LedgerMetadata(
                partner_id=None,
                narrative="Mapped partner signal to wallet commitment",
                tags=_ledger_tags(normalized_chain, signal_type),
                extra={
                    "handshake_fingerprint": handshake.fingerprint(),
                    "signal_type": signal_type,
                },
            ),
        )
        return TokenRegistryRecord(
            record_id=record_id,
            wallet_commitment=commitment,
            chain=normalized_chain,
            signal_type=signal_type,
            ciphertext=ciphertext,
            attestation=attestation,
            handshake_fingerprint=handshake.fingerprint(),
            created_at=timestamp,
        )

    def stealth_mint_yield(
        self,
        *,
        wallet_id: str,
        chain: str,
        mission_event: str,
        amount: float,
        handshake: HandshakeResult,
        emitter: "StealthYieldEmitter" | None = None,
        loyalty_points: float | None = None,
    ) -> "StealthYieldBatch":
        """Stealth mint a yield token tied to a mission event."""

        normalized_chain = _normalize_chain(chain)
        normalized_wallet = _normalize_wallet(wallet_id)
        commitment = _shake_commitment(normalized_wallet)
        if f"{normalized_chain}:{commitment}" not in self._registry:
            raise ValueError("wallet must be registered before minting yield")
        if emitter is None:
            import importlib

            stealth_module = importlib.import_module("vaultfire.yield.stealth_emitter")
            StealthYieldEmitter = getattr(stealth_module, "StealthYieldEmitter")
            emitter = StealthYieldEmitter(ledger=self._ledger, cipher_suite=self._cipher_suite)

        distribution: "StealthYieldDistribution" = emitter.build_distribution(
            wallet_id=normalized_wallet,
            amount=amount,
            loyalty_points=loyalty_points or 0.0,
            traits={"wallet_commitment": commitment},
        )
        batch = emitter.emit(
            mission_event=mission_event,
            chain=normalized_chain,
            distributions=[distribution],
            attestation_context={
                "handshake_id": handshake.handshake_id,
                "handshake_commitment": handshake.wallet_commitment,
                "handshake_fingerprint": handshake.fingerprint(),
            },
        )
        self._ledger.append(
            category="token-registry-yield",
            payload={
                "mission_event": mission_event,
                "wallet_commitment": commitment,
                "chain": normalized_chain,
                "batch_id": batch.batch_id,
                "attestation": batch.integrity_attestation,
            },
            metadata=LedgerMetadata(
                partner_id=None,
                narrative="Stealth yield minted",
                tags=("token-registry", normalized_chain, "yield"),
                extra={
                    "handshake_fingerprint": handshake.fingerprint(),
                    "batch_id": batch.batch_id,
                },
            ),
        )
        return batch


__all__ = [
    "VaultfireTokenRegistry",
    "TokenRegistryRecord",
    "WalletRegistration",
]
