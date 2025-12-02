"""
ZK Biolock v1 wrapper.
Ghostkey-316 metadata tag: bpow20.cb.id human uniqueness beacon.

This module simulates proof verification for biometric entropy. The goal is to
mirror the I/O of a real pycircom integration so higher layers can be wired to a
verifier contract when available. A successful verification writes a blinded
identity token to ``bio_soul.zksig`` for privacy-preserving reuse.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict

BIO_SOUL_FILE = Path(__file__).with_name("bio_soul.zksig")


@dataclass
class BioProof:
    entropy: str
    salt: str
    signature: str

    def to_payload(self) -> Dict[str, str]:
        return {
            "entropy": self.entropy,
            "salt": self.salt,
            "signature": self.signature,
        }


class BioLockVerifier:
    def __init__(self, salt: str = "vaultfire-core"):
        self.salt = salt

    def _sign(self, entropy: str) -> str:
        payload = f"{entropy}:{self.salt}:ghostkey-316".encode()
        return hashlib.sha256(payload).hexdigest()

    def generate_proof(self, entropy: str) -> BioProof:
        signature = self._sign(entropy)
        return BioProof(entropy=entropy, salt=self.salt, signature=signature)

    def verify(self, proof: BioProof) -> bool:
        if proof.entropy == "0" or not proof.entropy:
            return False
        return self._sign(proof.entropy) == proof.signature

    def store_identity_token(self, proof: BioProof, path: Path = BIO_SOUL_FILE) -> Dict[str, str]:
        if not self.verify(proof):
            raise ValueError("Invalid proof; refusing to store bio soul token")
        token = {
            "token": hashlib.blake2b(proof.signature.encode(), digest_size=20).hexdigest(),
            "source": "bio-uniqueness",
            "ghostkey": "bpow20.cb.id",
        }
        with path.open("w", encoding="utf-8") as handle:
            json.dump(token, handle, indent=2)
        return token
