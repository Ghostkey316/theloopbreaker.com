"""MPC + FHE orchestration utilities for Vaultfire."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Mapping, MutableMapping

from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID
from vaultfire.security.fhe import Ciphertext, FHECipherSuite


@dataclass(slots=True)
class MPCContribution:
    """Container describing an encrypted MPC contribution."""

    wallet: str
    ciphertext: Ciphertext
    context: str


class MPCFabric:
    """Prototype multi-party coordination fabric using FHE."""

    def __init__(self, *, cipher_suite: FHECipherSuite) -> None:
        self._cipher_suite = cipher_suite
        self._contributions: MutableMapping[str, MPCContribution] = {}
        self.architect_wallet = ARCHITECT_WALLET
        self.origin_node = ORIGIN_NODE_ID

    @property
    def participants(self) -> Iterable[str]:
        return tuple(self._contributions.keys())

    def submit_encrypted_payload(
        self,
        wallet: str,
        payload: Mapping[str, object],
        *,
        signal_context: str,
    ) -> MPCContribution:
        """Encrypt a participant payload and register it for MPC aggregation."""

        if not wallet or not wallet.strip():
            raise ValueError("wallet must be provided")
        if not signal_context:
            raise ValueError("signal_context is required")

        ciphertext = self._cipher_suite.encrypt_record(
            dict(payload),
            sensitive_fields=tuple(payload.keys()),
        )
        contribution = MPCContribution(wallet=wallet, ciphertext=ciphertext, context=signal_context)
        self._contributions[wallet] = contribution
        return contribution

    def collaborative_sum(self) -> Dict[str, object]:
        """Combine contributions into a single ciphertext and generate a proof."""

        if not self._contributions:
            raise ValueError("no contributions registered")
        ciphertexts = [item.ciphertext for item in self._contributions.values()]
        aggregate = self._cipher_suite.homomorphic_add(*ciphertexts)
        proof = self._cipher_suite.generate_zero_knowledge_commitment(
            aggregate,
            context="vaultfire::mpc_collaboration",
        )
        return {
            "ciphertext": aggregate,
            "proof": proof,
            "participants": len(ciphertexts),
            "architect_wallet": self.architect_wallet,
            "origin_node": self.origin_node,
        }

    def decrypt_summary(self) -> Dict[str, object]:
        """Produce a decrypted summary for compliance scoped review."""

        aggregate = self.collaborative_sum()["ciphertext"]
        value = self._cipher_suite.decrypt_record(aggregate)
        return {
            "approximate_value": value["approximate_value"],
            "moral_tag": value["moral_tag"],
            "participants": len(self._contributions),
        }


__all__ = ["MPCContribution", "MPCFabric"]
