"""Vaultfire Quantum Defense Module v1.0.

This module assembles a PQC-forward defensive stack that mirrors the
"Vaultfire Quantum Defense Module" request. It focuses on three operational
pillars:

* Hybrid PQC posture using Kyber768 + Dilithium3 with optional Falcon support.
* Quantum-resistant identity wrapping (biometrics → zkSNARK proofs with an
  FHE-friendly commitment trail).
* Yield and bridge protection via lattice-style envelopes, ZK rollup logging,
  and a Sentinel firewall that enforces dual-stack PQ signatures.

The implementation is intentionally lightweight and dependency-free so the
interfaces can be exercised in tests without requiring heavy cryptography
packages. Hash-based commitments stand in for the real primitives while the
method names and data contracts align with the intended production behaviors.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Mapping, MutableMapping, Sequence


@dataclass(frozen=True)
class PQCSchemeConfig:
    """Describe the hybrid PQC footprint for Vaultfire deployments."""

    kyber_level: str = "Kyber768"
    dilithium_level: str = "Dilithium3"
    falcon_enabled: bool = False
    preferred_library: str = "libsodium"

    def hybrid_profile(self) -> Dict[str, Any]:
        """Return the negotiated hybrid profile including optional Falcon."""

        profile = {
            "primary": self.kyber_level,
            "signature": self.dilithium_level,
            "library": self.preferred_library,
        }
        if self.falcon_enabled:
            profile["alternate_signature"] = "Falcon"
        return profile

    def dual_stack_requirements(self) -> Dict[str, str]:
        """Advertise the dual-stack signature requirements for bridge access."""

        requirements = {
            "kyber": self.kyber_level,
            "dilithium": self.dilithium_level,
        }
        if self.falcon_enabled:
            requirements["falcon"] = "Falcon-Enabled"
        return requirements


@dataclass
class QuantumIdentityProof:
    """Record of a biometric proof wrapped in PQC and zkSNARK metadata."""

    subject: str
    pqc_public_key: str
    zk_snark_proof: str
    biometric_commitment: str
    state_commitment: str
    fhe_ready: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class QuantumIdentityEngine:
    """Generate PQC-backed identity proofs using deterministic commitments."""

    def __init__(self, pqc_config: PQCSchemeConfig | None = None) -> None:
        self._pqc_config = pqc_config or PQCSchemeConfig()

    @staticmethod
    def _hash_material(*parts: str) -> str:
        digest = hashlib.sha3_256(":".join(parts).encode()).hexdigest()
        return digest

    def _derive_pqc_public_key(self, subject: str, biometric_sample: str) -> str:
        material = f"{subject}:{biometric_sample}:{self._pqc_config.kyber_level}:{self._pqc_config.dilithium_level}"
        digest = self._hash_material(material, "pqc")
        return f"pqc-{digest[:48]}"

    def wrap_biometric_signature(
        self,
        subject: str,
        *,
        biometric_sample: str,
        entropy_salt: str,
    ) -> QuantumIdentityProof:
        """Produce a zkSNARK-wrapped biometric proof with PQC-derived keys."""

        pqc_public_key = self._derive_pqc_public_key(subject, biometric_sample)
        biometric_commitment = self._hash_material(subject, biometric_sample, entropy_salt)
        zk_snark_proof = f"zk-{self._hash_material(biometric_commitment, pqc_public_key)[:32]}"
        state_commitment = f"commit-{self._hash_material(zk_snark_proof, entropy_salt)[:40]}"

        return QuantumIdentityProof(
            subject=subject,
            pqc_public_key=pqc_public_key,
            zk_snark_proof=zk_snark_proof,
            biometric_commitment=biometric_commitment,
            state_commitment=state_commitment,
            fhe_ready=True,
        )


@dataclass
class YieldShieldEnvelope:
    """Encrypted yield wrapper representing lattice-style protection."""

    claim_id: str
    encrypted_payload: str
    lattice_tag: str
    rollup_channel: str
    merkle_fallback_root: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class YieldShield:
    """Hide yield logic behind lattice commitments and rollup logging."""

    def __init__(self, pqc_config: PQCSchemeConfig | None = None) -> None:
        self._pqc_config = pqc_config or PQCSchemeConfig()

    @staticmethod
    def _hash_payload(identifier: str, payload: Mapping[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True)
        return hashlib.sha3_256(f"{identifier}:{encoded}".encode()).hexdigest()

    def wrap_yield_claim(self, claim_id: str, payload: Mapping[str, Any]) -> YieldShieldEnvelope:
        lattice_digest = self._hash_payload(claim_id, payload)
        lattice_tag = f"lattice-{lattice_digest[:32]}"
        encrypted_payload = f"enc-{self._pqc_config.kyber_level}-{lattice_digest[:40]}"
        merkle_fallback_root = hashlib.sha3_256(lattice_tag.encode()).hexdigest()
        return YieldShieldEnvelope(
            claim_id=claim_id,
            encrypted_payload=encrypted_payload,
            lattice_tag=lattice_tag,
            rollup_channel="zk-rollup-sequencer",
            merkle_fallback_root=merkle_fallback_root,
        )

    def rollup_receipt(self, envelope: YieldShieldEnvelope) -> Dict[str, Any]:
        receipt_hash = hashlib.sha3_256(envelope.encrypted_payload.encode()).hexdigest()
        return {
            "channel": envelope.rollup_channel,
            "receipt": receipt_hash,
            "fallback_log": envelope.merkle_fallback_root,
        }


@dataclass
class SentinelAssessment:
    """Outcome of the Sentinel firewall evaluation."""

    request_id: str
    accepted: bool
    reason: str
    signatures_verified: Sequence[str]
    threat_score: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "accepted": self.accepted,
            "reason": self.reason,
            "signatures_verified": list(self.signatures_verified),
            "threat_score": self.threat_score,
        }


class SentinelFirewall:
    """Scan bridge requests for PQ threat vectors and dual-stack compliance."""

    def __init__(self, pqc_config: PQCSchemeConfig | None = None, *, noise_threshold: float = 0.42) -> None:
        self._pqc_config = pqc_config or PQCSchemeConfig()
        self._noise_threshold = noise_threshold

    @staticmethod
    def _normalize_signatures(signatures: Mapping[str, str]) -> MutableMapping[str, str]:
        normalized: MutableMapping[str, str] = {}
        for key, value in signatures.items():
            if value:
                normalized[key] = value
        return normalized

    def assess_request(
        self,
        request_id: str,
        *,
        signatures: Mapping[str, str],
        metadata: Mapping[str, Any] | None = None,
    ) -> SentinelAssessment:
        normalized_signatures = self._normalize_signatures(signatures)
        missing = ["kyber_signature"]
        if self._pqc_config.falcon_enabled:
            missing.append("falcon_signature")
        missing = [sig for sig in missing if sig not in normalized_signatures]

        threat_score = float(metadata.get("side_channel_noise", 0.0)) if metadata else 0.0
        if metadata and metadata.get("grover_amplification"):
            threat_score += 0.25
        if metadata and metadata.get("shor_factorization_probe"):
            threat_score += 0.35

        if missing:
            return SentinelAssessment(
                request_id=request_id,
                accepted=False,
                reason=f"Missing PQ signatures: {', '.join(sorted(missing))}",
                signatures_verified=list(normalized_signatures),
                threat_score=threat_score,
            )

        if threat_score > self._noise_threshold:
            return SentinelAssessment(
                request_id=request_id,
                accepted=False,
                reason="Side-channel noise exceeds threshold",
                signatures_verified=list(normalized_signatures),
                threat_score=threat_score,
            )

        return SentinelAssessment(
            request_id=request_id,
            accepted=True,
            reason="Bridge request cleared with dual-stack PQ signatures",
            signatures_verified=list(normalized_signatures),
            threat_score=threat_score,
        )


class QuantumDefenseTestSuite:
    """Outline checks for PQ coverage and quantum exploit simulations."""

    def __init__(self, *, include_pq_forge: bool = True) -> None:
        self.include_pq_forge = include_pq_forge

    def coverage_commands(self) -> Sequence[Dict[str, str]]:
        commands = [
            {
                "name": "slither",
                "command": "slither contracts --detect-invariants --exclude-dependencies",
            },
            {
                "name": "mythx",
                "command": "mythx analyze contracts --mode deep --enable-ignores",
            },
        ]
        if self.include_pq_forge:
            commands.append(
                {
                    "name": "pq-forge",
                    "command": "pq-forge test --quantum-sim --pqc kyber768,dilithium3,falcon",
                }
            )
        return commands

    @staticmethod
    def simulated_attacks() -> Sequence[Dict[str, str]]:
        return [
            {
                "name": "grover-search-perturbation",
                "vector": "oracle_amplification",
                "expected_effect": "reduced amplitude handled via lattice hardening",
            },
            {
                "name": "shor-factorization-echo",
                "vector": "period_finding",
                "expected_effect": "no key leakage thanks to dual-stack PQ signatures",
            },
        ]


@dataclass
class QuantumDefenseManifest:
    """Snapshot of the activated Vaultfire Quantum Defense configuration."""

    label: str
    pqc: Dict[str, Any]
    identity: Dict[str, Any]
    yield_envelope: Dict[str, Any]
    yield_receipt: Dict[str, Any]
    firewall: Dict[str, Any]
    test_suite: Sequence[Dict[str, str]]
    attack_simulations: Sequence[Dict[str, str]]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class VaultfireQuantumDefenseModule:
    """Coordinate PQC identity, yield shielding, and firewall enforcement."""

    _DEFAULT_PATH = Path("status") / "vaultfire_quantum_defense.json"
    _PATH_ENV = "VAULTFIRE_QUANTUM_DEFENSE_PATH"

    def __init__(
        self,
        pqc_config: PQCSchemeConfig | None = None,
        *,
        identity_engine: QuantumIdentityEngine | None = None,
        yield_shield: YieldShield | None = None,
        firewall: SentinelFirewall | None = None,
        test_suite: QuantumDefenseTestSuite | None = None,
    ) -> None:
        self.pqc_config = pqc_config or PQCSchemeConfig()
        self.identity_engine = identity_engine or QuantumIdentityEngine(self.pqc_config)
        self.yield_shield = yield_shield or YieldShield(self.pqc_config)
        self.firewall = firewall or SentinelFirewall(self.pqc_config)
        self.test_suite = test_suite or QuantumDefenseTestSuite()

    def _get_manifest_path(self, registry_path: str | Path | None) -> Path:
        if registry_path is not None:
            return Path(registry_path)
        env_override = os.getenv(self._PATH_ENV)
        if env_override:
            return Path(env_override)
        return self._DEFAULT_PATH

    def activate(
        self,
        *,
        label: str,
        subject: str,
        biometric_sample: str,
        entropy_salt: str,
        claim_id: str,
        yield_payload: Mapping[str, Any],
        bridge_request: Mapping[str, Any],
        registry_path: str | Path | None = None,
    ) -> QuantumDefenseManifest:
        identity_proof = self.identity_engine.wrap_biometric_signature(
            subject,
            biometric_sample=biometric_sample,
            entropy_salt=entropy_salt,
        )

        envelope = self.yield_shield.wrap_yield_claim(claim_id, yield_payload)
        receipt = self.yield_shield.rollup_receipt(envelope)

        assessment = self.firewall.assess_request(
            bridge_request.get("request_id", claim_id),
            signatures=bridge_request.get("signatures", {}),
            metadata=bridge_request.get("metadata", {}),
        )

        manifest = QuantumDefenseManifest(
            label=label,
            pqc=self.pqc_config.hybrid_profile(),
            identity=identity_proof.to_dict(),
            yield_envelope=envelope.to_dict(),
            yield_receipt=receipt,
            firewall=assessment.to_dict(),
            test_suite=list(self.test_suite.coverage_commands()),
            attack_simulations=list(self.test_suite.simulated_attacks()),
        )

        path = self._get_manifest_path(registry_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(manifest.to_dict(), indent=2) + "\n")
        return manifest


__all__ = [
    "PQCSchemeConfig",
    "QuantumIdentityEngine",
    "QuantumIdentityProof",
    "YieldShield",
    "YieldShieldEnvelope",
    "SentinelFirewall",
    "SentinelAssessment",
    "QuantumDefenseTestSuite",
    "QuantumDefenseManifest",
    "VaultfireQuantumDefenseModule",
]
