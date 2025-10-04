"""FHE integration helpers for Vaultfire protocol flows."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Mapping

from vaultfire.security.fhe import Ciphertext, FHECipherSuite


@dataclass(slots=True)
class PrivateSignal:
    """Represents an encrypted behavioral signal emitted by the protocol."""

    ciphertext: Ciphertext
    proof: Dict[str, Any]
    context: str

    def export(self) -> Dict[str, Any]:
        return {
            "ciphertext": self.ciphertext.serialize(),
            "proof": self.proof,
            "context": self.context,
        }


def prepare_private_signal(
    *,
    wallet_id: str,
    signal_type: str,
    payload: Mapping[str, Any],
    cipher_suite: FHECipherSuite,
    moral_orientation: str,
) -> PrivateSignal:
    """Encrypt a behavioral signal for private routing."""

    if not wallet_id:
        raise ValueError("wallet_id is required")
    if not signal_type:
        raise ValueError("signal_type is required")

    metadata = {
        "wallet_id": wallet_id,
        "signal_type": signal_type,
        "moral_orientation": moral_orientation,
    }
    structured_payload: Dict[str, Any] = {**dict(payload), **metadata}
    sensitive_fields = tuple(dict(payload).keys())
    ciphertext = cipher_suite.encrypt_record(structured_payload, sensitive_fields=sensitive_fields)
    proof = cipher_suite.generate_zero_knowledge_commitment(ciphertext, context=f"signal::{signal_type}")
    return PrivateSignal(ciphertext=ciphertext, proof=proof, context=signal_type)


def seal_belief_yield_event(
    *,
    belief_id: str,
    yield_parameters: Mapping[str, Any],
    cipher_suite: FHECipherSuite,
    cross_chain_domains: Iterable[str],
) -> Dict[str, Any]:
    """Produce an encrypted yield event with cross-chain hints."""

    ciphertext = cipher_suite.encrypt_record(
        {
            "belief_id": belief_id,
            "yield": dict(yield_parameters),
            "domains": list(cross_chain_domains),
        },
        sensitive_fields=("yield",),
    )
    zk = cipher_suite.generate_zero_knowledge_commitment(ciphertext, context=f"yield::{belief_id}")
    return {
        "ciphertext": ciphertext.serialize(),
        "commitment": zk,
        "cross_chain_domains": list(cross_chain_domains),
        "belief_id": belief_id,
    }


def build_institutional_onboarding_packet(
    *,
    institution: str,
    credential_hash: str,
    cipher_suite: FHECipherSuite,
    risk_controls: Mapping[str, Any],
) -> Dict[str, Any]:
    """Generate an encrypted onboarding packet for institutional partners."""

    payload = {
        "institution": institution,
        "credential_hash": credential_hash,
        "risk_controls": dict(risk_controls),
    }
    ciphertext = cipher_suite.encrypt_record(payload, sensitive_fields=("credential_hash",))
    attestation = cipher_suite.attest_integrity([ciphertext])
    return {
        "ciphertext": ciphertext.serialize(),
        "attestation": attestation,
        "institution": institution,
    }


def verify_cross_chain_payload(
    *,
    packet: Mapping[str, Any],
    cipher_suite: FHECipherSuite,
    moral_baseline: float,
) -> Dict[str, Any]:
    """Inspect a cross-chain payload while preserving confidentiality."""

    ciphertext_data = packet.get("ciphertext")
    if not isinstance(ciphertext_data, Mapping):
        raise ValueError("packet missing ciphertext")
    ciphertext = Ciphertext.deserialize(ciphertext_data)
    decrypted = cipher_suite.decrypt_record(ciphertext)
    return {
        "orientation": "aligned" if decrypted["approximate_value"] >= moral_baseline else "review",
        "commitment": packet.get("commitment"),
        "ciphertext": ciphertext.serialize(),
        "moral_tag": cipher_suite.moral_tag,
    }


__all__ = [
    "PrivateSignal",
    "prepare_private_signal",
    "seal_belief_yield_event",
    "build_institutional_onboarding_packet",
    "verify_cross_chain_payload",
]
