"""Private staking primitives powered by the Vaultfire FHE layer."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Mapping

from vaultfire.security.fhe import Ciphertext, FHECipherSuite


@dataclass(slots=True)
class PrivateStake:
    """Encapsulates an encrypted staking position."""

    wallet_id: str
    ciphertext: Ciphertext
    commitment: Dict[str, Any]
    domains: list[str]
    moral_score: float

    def export(self) -> Dict[str, Any]:
        return {
            "wallet_id": self.wallet_id,
            "ciphertext": self.ciphertext.serialize(),
            "commitment": self.commitment,
            "domains": self.domains,
            "moral_score": self.moral_score,
        }


class PrivateStakingLedger:
    """Maintains encrypted stakes while supporting homomorphic aggregation."""

    def __init__(self, cipher_suite: FHECipherSuite, *, baseline_orientation: float = 55.0) -> None:
        self._cipher_suite = cipher_suite
        self._baseline_orientation = baseline_orientation
        self._stakes: Dict[str, Ciphertext] = {}

    def stake(
        self,
        wallet_id: str,
        amount: float,
        *,
        belief_vector: Mapping[str, Any],
        moral_orientation: float,
        cross_chain_domains: Iterable[str] | None = None,
    ) -> PrivateStake:
        """Create or update a confidential staking position."""

        alignment_multiplier = (
            moral_orientation / self._baseline_orientation if self._baseline_orientation else 1.0
        )
        weighted_amount = amount * alignment_multiplier
        ciphertext = self._cipher_suite.encrypt_value(
            weighted_amount,
            metadata={
                "wallet_id": wallet_id,
                "belief_vector": dict(belief_vector),
                "alignment_multiplier": alignment_multiplier,
            },
        )
        commitment = self._cipher_suite.generate_zero_knowledge_commitment(
            ciphertext, context="staking.position"
        )
        self._stakes[wallet_id] = (
            self._cipher_suite.homomorphic_add(self._stakes[wallet_id], ciphertext)
            if wallet_id in self._stakes
            else ciphertext
        )
        return PrivateStake(
            wallet_id=wallet_id,
            ciphertext=ciphertext,
            commitment=commitment,
            domains=list(cross_chain_domains or ()),
            moral_score=moral_orientation,
        )

    def total_staked_ciphertext(self) -> Ciphertext | None:
        """Return the aggregated ciphertext of all stakes."""

        if not self._stakes:
            return None
        aggregates = list(self._stakes.values())
        return self._cipher_suite.homomorphic_add(*aggregates)

    def total_staked_value(self) -> float:
        """Decrypt the aggregated stake exposure."""

        ciphertext = self.total_staked_ciphertext()
        if not ciphertext:
            return 0.0
        return self._cipher_suite.decrypt_value(ciphertext)

    def export_for_lending(self) -> Dict[str, Any]:
        """Produce a payload suitable for encrypted lending venues."""

        aggregate = self.total_staked_ciphertext()
        if not aggregate:
            return {"total": 0.0, "ciphertext": None, "moral_tag": self._cipher_suite.moral_tag}
        commitment = self._cipher_suite.generate_zero_knowledge_commitment(
            aggregate, context="staking.aggregate"
        )
        return {
            "ciphertext": aggregate.serialize(),
            "commitment": commitment,
            "total_estimate": self._cipher_suite.decrypt_value(aggregate),
            "moral_tag": self._cipher_suite.moral_tag,
        }


class ConfidentialVaultScoring:
    """Homomorphic contributor scoring for the Vaultfire contributor vault."""

    def __init__(self, cipher_suite: FHECipherSuite, *, cross_chain_domains: Iterable[str] | None = None) -> None:
        self._cipher_suite = cipher_suite
        self._scores: Dict[str, Ciphertext] = {}
        self._domains = list(cross_chain_domains or ())

    def submit_score(
        self,
        contributor_id: str,
        metrics: Mapping[str, float],
        moral_orientation: float,
    ) -> Dict[str, Any]:
        """Encrypt and store a contributor score."""

        base_score = sum(metrics.values())
        ciphertext = self._cipher_suite.encrypt_value(
            base_score,
            metadata={"contributor_id": contributor_id, "metrics": dict(metrics)},
        )
        self._scores[contributor_id] = ciphertext
        commitment = self._cipher_suite.generate_zero_knowledge_commitment(
            ciphertext, context="vault.score"
        )
        return {
            "contributor_id": contributor_id,
            "ciphertext": ciphertext.serialize(),
            "commitment": commitment,
            "moral_orientation": moral_orientation,
            "domains": self._domains,
        }

    def score_delta(self, contributor_id: str, delta: float) -> Dict[str, Any]:
        """Adjust a contributor score homomorphically."""

        if contributor_id not in self._scores:
            raise KeyError(f"Unknown contributor {contributor_id}")
        adjustment = self._cipher_suite.encrypt_value(delta)
        updated = self._cipher_suite.homomorphic_add(self._scores[contributor_id], adjustment)
        self._scores[contributor_id] = updated
        return {
            "contributor_id": contributor_id,
            "ciphertext": updated.serialize(),
            "moral_tag": self._cipher_suite.moral_tag,
        }

    def export_attestation(self) -> Dict[str, Any]:
        """Return an integrity attestation for all stored scores."""

        ciphertexts = list(self._scores.values())
        attestation = self._cipher_suite.attest_integrity(ciphertexts)
        return {
            "attestation": attestation,
            "domains": self._domains,
            "moral_tag": self._cipher_suite.moral_tag,
        }


__all__ = [
    "PrivateStake",
    "PrivateStakingLedger",
    "ConfidentialVaultScoring",
]
