"""Guardian Ring zkSNARK verification helper.

This module provides a thin wrapper around the Guardian Ring circuit so that
other Vaultfire components can quickly validate Poseidon-based alignments
without depending on heavy proving stacks during tests. The wrapper emulates a
snarkjs/pySNARK interface by recomputing the expected commitment locally and
ensuring the supplied proof payload matches.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from hashlib import sha3_256
from typing import Any, Mapping, MutableMapping


_SUPPORTED_BACKENDS = {"snarkjs", "pysnark"}


def _canonicalize(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _canonicalize(value[key]) for key in sorted(value)}
    if isinstance(value, (list, tuple, set)):
        return [_canonicalize(item) for item in value]
    return value


def _poseidon_like_digest(spine_hash: str, yield_receipt: str, loop_nonce: str) -> str:
    payload = json.dumps(
        {
            "spine_hash": spine_hash,
            "yield_receipt": yield_receipt,
            "loop_nonce": loop_nonce,
        },
        sort_keys=True,
    )
    return sha3_256(payload.encode()).hexdigest()


@dataclass(frozen=True)
class GuardianRingProof:
    """Serializable proof bundle returned by :class:`GuardianRingVerifier`."""

    spine_hash: str
    yield_receipt: str
    loop_nonce: str
    alignment: str
    backend: str
    proof_blob: str

    def to_dict(self) -> MutableMapping[str, Any]:
        return asdict(self)


class GuardianRingVerifier:
    """Validate Guardian Ring proofs against deterministic commitments."""

    def __init__(self, *, backend: str = "snarkjs") -> None:
        self.backend = self._normalize_backend(backend)

    def _normalize_backend(self, backend: str) -> str:
        normalized = backend.lower().strip()
        if normalized not in _SUPPORTED_BACKENDS:
            valid = ", ".join(sorted(_SUPPORTED_BACKENDS))
            raise ValueError(f"backend must be one of: {valid}")
        return normalized

    def _normalize_field(self, name: str, value: Any) -> str:
        if value is None:
            raise ValueError(f"{name} cannot be None")
        text = str(value).strip()
        if not text:
            raise ValueError(f"{name} cannot be empty")
        return text

    def derive_alignment(self, spine_hash: Any, yield_receipt: Any, loop_nonce: Any) -> str:
        """Return a Poseidon-style digest for the provided inputs."""

        normalized_spine = self._normalize_field("spine_hash", spine_hash)
        normalized_receipt = self._normalize_field("yield_receipt", yield_receipt)
        normalized_nonce = self._normalize_field("loop_nonce", loop_nonce)
        return _poseidon_like_digest(normalized_spine, normalized_receipt, normalized_nonce)

    def build_proof(self, *, spine_hash: Any, yield_receipt: Any, loop_nonce: Any) -> GuardianRingProof:
        alignment = self.derive_alignment(spine_hash, yield_receipt, loop_nonce)
        transcript = _canonicalize(
            {
                "backend": self.backend,
                "alignment": alignment,
                "witness": {
                    "spine_hash": self._normalize_field("spine_hash", spine_hash),
                    "yield_receipt": self._normalize_field("yield_receipt", yield_receipt),
                    "loop_nonce": self._normalize_field("loop_nonce", loop_nonce),
                },
            }
        )
        proof_blob = sha3_256(json.dumps(transcript, sort_keys=True).encode()).hexdigest()
        return GuardianRingProof(
            spine_hash=str(spine_hash),
            yield_receipt=str(yield_receipt),
            loop_nonce=str(loop_nonce),
            alignment=alignment,
            backend=self.backend,
            proof_blob=proof_blob,
        )

    def verify(self, proof: GuardianRingProof | Mapping[str, Any]) -> bool:
        """Return True when the commitment aligns with the witness payload."""

        payload = proof.to_dict() if isinstance(proof, GuardianRingProof) else dict(proof)
        backend = self._normalize_backend(payload.get("backend", self.backend))
        expected_alignment = self.derive_alignment(
            payload.get("spine_hash"), payload.get("yield_receipt"), payload.get("loop_nonce")
        )
        provided_alignment = self._normalize_field("alignment", payload.get("alignment"))
        proof_blob = self._normalize_field("proof_blob", payload.get("proof_blob"))

        if backend != self.backend:
            return False
        if provided_alignment != expected_alignment:
            return False

        recalculated_blob = sha3_256(
            json.dumps(
                _canonicalize(
                    {
                        "backend": backend,
                        "alignment": expected_alignment,
                        "witness": {
                            "spine_hash": self._normalize_field("spine_hash", payload.get("spine_hash")),
                            "yield_receipt": self._normalize_field("yield_receipt", payload.get("yield_receipt")),
                            "loop_nonce": self._normalize_field("loop_nonce", payload.get("loop_nonce")),
                        },
                    }
                ),
                sort_keys=True,
            ).encode()
        ).hexdigest()

        return recalculated_blob == proof_blob


__all__ = ["GuardianRingVerifier", "GuardianRingProof"]
