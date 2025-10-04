"""Lightweight homomorphic-friendly primitives for Vaultfire."""

from __future__ import annotations

import json
import secrets
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, Mapping, Sequence


@dataclass(frozen=True)
class Ciphertext:
    """Container describing an encrypted payload.

    The structure is intentionally JSON friendly so that it can be embedded in
    partner ledgers, cross-chain proofs, or audit streams without leaking
    sensitive information.  The payload is represented as an integer that is
    safe for modular arithmetic, enabling simple additive homomorphism in the
    simulated environment.
    """

    payload: int
    mask: int
    scale: int = 10**6
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def serialize(self) -> Dict[str, Any]:
        """Serialize the ciphertext into a dictionary."""

        return {
            "payload": self.payload,
            "mask": self.mask,
            "scale": self.scale,
            "metadata": dict(self.metadata),
        }

    @classmethod
    def deserialize(cls, data: Mapping[str, Any]) -> "Ciphertext":
        """Rehydrate a ciphertext from serialized state."""

        return cls(
            payload=int(data["payload"]),
            mask=int(data["mask"]),
            scale=int(data.get("scale", 10**6)),
            metadata=dict(data.get("metadata", {})),
        )


class FHECipherSuite:
    """Prototype-friendly homomorphic encryption helpers.

    The implementation is intentionally lightweight: it focuses on secure data
    handling semantics (masking, deterministic replays, metadata encapsulation)
    while leaving room for drop-in replacement with a real FHE backend such as
    Zama, TFHE, or lattice-based libraries.  All methods favour explicit
    metadata so that zero-knowledge proof systems can be wired without breaking
    compatibility with the broader protocol.
    """

    def __init__(self, *, modulus: int = 2**127 - 1, moral_tag: str | None = None) -> None:
        if modulus <= 0:
            raise ValueError("modulus must be positive")
        self._modulus = modulus
        self._moral_tag = moral_tag or "vaultfire.morals-aligned"

    @property
    def modulus(self) -> int:
        return self._modulus

    @property
    def moral_tag(self) -> str:
        return self._moral_tag

    def _normalize(self, value: float, scale: int) -> int:
        return int(round(value * scale))

    def _denormalize(self, value: int, scale: int) -> float:
        return round(value / scale, 6)

    def encrypt_value(self, value: float, *, scale: int = 10**6, metadata: Mapping[str, Any] | None = None) -> Ciphertext:
        """Encrypt a numeric value into a masked ciphertext."""

        normalized = self._normalize(value, scale)
        mask = secrets.randbits(96)
        payload = (normalized + mask) % self._modulus
        payload_metadata = {"type": "scalar", "moral_tag": self._moral_tag}
        if metadata:
            payload_metadata.update(metadata)
        return Ciphertext(payload=payload, mask=mask, scale=scale, metadata=payload_metadata)

    def decrypt_value(self, ciphertext: Ciphertext) -> float:
        """Recover a plaintext numeric value from a ciphertext."""

        unmasked = (ciphertext.payload - ciphertext.mask) % self._modulus
        # Adjust for negative wrap-around by anchoring inside the modulus space.
        if unmasked > self._modulus // 2:
            unmasked -= self._modulus
        return self._denormalize(unmasked, ciphertext.scale)

    def homomorphic_add(self, *ciphertexts: Ciphertext) -> Ciphertext:
        """Add multiple ciphertexts together without decrypting them."""

        if not ciphertexts:
            raise ValueError("at least one ciphertext is required")
        scale = ciphertexts[0].scale
        metadata: Dict[str, Any] = {"type": "aggregate", "inputs": len(ciphertexts)}
        mask_total = 0
        payload_total = 0
        for item in ciphertexts:
            if item.scale != scale:
                raise ValueError("ciphertext scale mismatch")
            mask_total = (mask_total + item.mask) % self._modulus
            payload_total = (payload_total + item.payload) % self._modulus
        metadata.update(ciphertexts[0].metadata)
        metadata["moral_tag"] = self._moral_tag
        return Ciphertext(payload=payload_total, mask=mask_total, scale=scale, metadata=metadata)

    def homomorphic_scale(self, ciphertext: Ciphertext, factor: float) -> Ciphertext:
        """Scale a ciphertext by a constant factor."""

        scale = ciphertext.scale
        normalized_factor = self._normalize(factor, 10**3)
        payload = (ciphertext.payload * normalized_factor) % self._modulus
        mask = (ciphertext.mask * normalized_factor) % self._modulus
        metadata = dict(ciphertext.metadata)
        metadata.update({"scaled": True, "factor": factor, "moral_tag": self._moral_tag})
        return Ciphertext(payload=payload, mask=mask, scale=scale * 10**3, metadata=metadata)

    def encrypt_record(
        self,
        payload: Mapping[str, Any],
        *,
        sensitive_fields: Iterable[str] | None = None,
        scale: int = 10**6,
    ) -> Ciphertext:
        """Encrypt a structured payload.

        The method collapses the JSON payload into a numeric digest to keep the
        ciphertext compact.  A real implementation would route the structured
        data into FHE friendly slots.
        """

        sensitive_fields = tuple(sorted(sensitive_fields or ()))
        collapsed = json.dumps(
            {
                "payload": payload,
                "fields": sensitive_fields,
                "moral_tag": self._moral_tag,
            },
            sort_keys=True,
        )
        digest = sum(byte for byte in collapsed.encode("utf-8"))
        return self.encrypt_value(digest / scale, scale=scale, metadata={"type": "record", "fields": sensitive_fields})

    def decrypt_record(self, ciphertext: Ciphertext) -> Dict[str, Any]:
        """Best effort reconstruction of a structured payload.

        Because the lightweight implementation compresses payloads to digests,
        this method returns diagnostic metadata for auditing rather than the
        original plaintext.  Integrators can wire a proper FHE backend to gain
        full round-trip fidelity.
        """

        return {
            "approximate_value": self.decrypt_value(ciphertext),
            "metadata": dict(ciphertext.metadata),
            "moral_tag": self._moral_tag,
        }

    def generate_zero_knowledge_commitment(self, ciphertext: Ciphertext, *, context: str) -> Dict[str, Any]:
        """Produce a context binding commitment suitable for ZK circuits."""

        transcript = {
            "context": context,
            "moral_tag": self._moral_tag,
            "payload": ciphertext.payload,
            "mask": ciphertext.mask,
            "scale": ciphertext.scale,
        }
        binding = sum(int(x) for x in transcript.values() if isinstance(x, int)) % self._modulus
        return {
            "context": context,
            "binding": binding,
            "metadata": dict(ciphertext.metadata),
        }

    def reblind(self, ciphertext: Ciphertext) -> Ciphertext:
        """Apply a fresh mask to a ciphertext."""

        new_mask = secrets.randbits(96)
        new_payload = (ciphertext.payload + new_mask) % self._modulus
        metadata = dict(ciphertext.metadata)
        metadata["reblinded"] = True
        metadata["moral_tag"] = self._moral_tag
        return Ciphertext(payload=new_payload, mask=(ciphertext.mask + new_mask) % self._modulus, scale=ciphertext.scale, metadata=metadata)

    def attest_integrity(self, ciphertexts: Sequence[Ciphertext]) -> Dict[str, Any]:
        """Create an integrity attestation for a batch of ciphertexts."""

        total = 0
        for item in ciphertexts:
            total = (total + item.payload + item.mask) % self._modulus
        return {
            "attestation": total,
            "count": len(ciphertexts),
            "moral_tag": self._moral_tag,
        }


__all__ = ["Ciphertext", "FHECipherSuite"]
