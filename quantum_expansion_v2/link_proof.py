"""
Vaultfire Quantum Expansion Phase 2 - ZK Chainlinker wrapper.
Ghostkey-316 metadata tag: wallet bpow20.cb.id cross-domain link verification.

This module provides a lightweight Python interface to simulate generation and
verification of zero-knowledge proofs that link the Ghostkey-316 identity to
partner domains (Base, Zora, NS3). In production, this would leverage pycircom
and an onchain verifier contract; here we provide deterministic placeholders
that allow tests and downstream integrations to reason about the handshake.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

SUPPORTED_DOMAINS = {
    "base": 0,
    "zora": 1,
    "ns3": 2,
}


@dataclass
class LinkProof:
    identity_commitment: str
    domain: str
    signature: str
    witness_flags: List[bool] = field(default_factory=lambda: [True, True, True])

    def to_payload(self) -> Dict[str, str]:
        return {
            "identity_commitment": self.identity_commitment,
            "domain": self.domain,
            "signature": self.signature,
        }


class ChainlinkerVerifier:
    """Simulated verifier for cross-domain moral signature proofs."""

    def __init__(self, allowed_identity: str, allowed_domains: Optional[Iterable[str]] = None):
        self.allowed_identity = allowed_identity
        self.allowed_domains = set(allowed_domains) if allowed_domains is not None else set(SUPPORTED_DOMAINS.keys())

    @staticmethod
    def _domain_flag(domain: str) -> int:
        normalized = domain.lower()
        if normalized not in SUPPORTED_DOMAINS:
            raise ValueError(f"Unsupported domain '{domain}'")
        return SUPPORTED_DOMAINS[normalized]

    @staticmethod
    def _hash_payload(payload: Dict[str, str]) -> str:
        serialized = json.dumps(payload, sort_keys=True).encode()
        return hashlib.sha256(serialized).hexdigest()

    def _verify_signature(self, proof: LinkProof) -> bool:
        expected = self._hash_payload({
            "identity": proof.identity_commitment,
            "domain": proof.domain.lower(),
            "ghostkey": "bpow20.cb.id",
        })
        return proof.signature == expected

    def verify(self, proof: LinkProof) -> bool:
        if proof.identity_commitment != self.allowed_identity:
            return False
        if proof.domain.lower() not in self.allowed_domains:
            return False
        if not proof.witness_flags[self._domain_flag(proof.domain)]:
            return False
        return self._verify_signature(proof)

    def generate_proof(self, domain: str) -> LinkProof:
        normalized_domain = domain.lower()
        _ = self._domain_flag(normalized_domain)
        payload = {
            "identity": self.allowed_identity,
            "domain": normalized_domain,
            "ghostkey": "bpow20.cb.id",
        }
        signature = self._hash_payload(payload)
        return LinkProof(
            identity_commitment=self.allowed_identity,
            domain=normalized_domain,
            signature=signature,
            witness_flags=[d in self.allowed_domains for d in SUPPORTED_DOMAINS],
        )


def export_proof(proof: LinkProof, path: str) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(proof.to_payload(), handle, indent=2)


def load_proof(path: str) -> LinkProof:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return LinkProof(
        identity_commitment=payload["identity_commitment"],
        domain=payload["domain"],
        signature=payload["signature"],
    )
