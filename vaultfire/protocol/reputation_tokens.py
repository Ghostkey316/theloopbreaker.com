"""Encrypted reputation token helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Mapping, MutableMapping

from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID
from vaultfire.security.fhe import Ciphertext, FHECipherSuite


@dataclass(slots=True)
class EncryptedTrustToken:
    wallet: str
    ciphertext: Ciphertext
    proof: Dict[str, object]
    score: float
    manifest: Mapping[str, object]


class ReputationLedger:
    """Soulbound encrypted trust token ledger."""

    def __init__(self, *, cipher_suite: FHECipherSuite) -> None:
        self._cipher_suite = cipher_suite
        self._tokens: MutableMapping[str, EncryptedTrustToken] = {}
        self.architect_wallet = ARCHITECT_WALLET
        self.origin_node = ORIGIN_NODE_ID

    def mint(
        self,
        *,
        wallet: str,
        score: float,
        manifest: Mapping[str, object],
    ) -> EncryptedTrustToken:
        if wallet in self._tokens:
            raise ValueError("soulbound token already minted for wallet")
        ciphertext = self._cipher_suite.encrypt_value(
            score,
            metadata={"type": "EncryptedTrustSBT", "wallet": wallet},
        )
        proof = self._cipher_suite.generate_zero_knowledge_commitment(
            ciphertext,
            context=f"sbt::{wallet}",
        )
        token = EncryptedTrustToken(
            wallet=wallet,
            ciphertext=ciphertext,
            proof=proof,
            score=score,
            manifest=dict(manifest),
        )
        self._tokens[wallet] = token
        return token

    def get_token(self, wallet: str) -> EncryptedTrustToken | None:
        return self._tokens.get(wallet)

    def transfer(self, from_wallet: str, to_wallet: str) -> None:
        raise PermissionError("EncryptedTrustSBT tokens are soulbound and non-transferable")


__all__ = ["EncryptedTrustToken", "ReputationLedger"]
