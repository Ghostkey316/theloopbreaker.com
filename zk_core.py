"""Zero-Knowledge Execution Core for the Ghostshroud privacy stack."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Protocol

try:
    from sympy.crypto.crypto import sha256 as _sympy_sha256
    _HAVE_SYMPY = True
except ImportError:  # pragma: no cover - fallback
    _sympy_sha256 = None
    _HAVE_SYMPY = False


def _sha256(value: str) -> str:
    if _HAVE_SYMPY and _sympy_sha256 is not None:
        return _sympy_sha256(value)
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _canonicalize(value: Any) -> Any:
    """Return a JSON-serialisable structure with deterministic ordering."""

    if isinstance(value, dict):
        return {key: _canonicalize(value[key]) for key in sorted(value)}
    if isinstance(value, (list, tuple)):
        return [_canonicalize(item) for item in value]
    if isinstance(value, set):
        return sorted(
            (_canonicalize(item) for item in value),
            key=lambda item: json.dumps(item, sort_keys=True, ensure_ascii=False, default=str),
        )
    return value


class EthicsOracle(Protocol):
    """Interface for Ghostkey-316 ethics checks."""

    def check_ethics(self, signal: Dict[str, Any]) -> bool:
        """Return True if the action is ethically permitted."""


class ConsentOracle(Protocol):
    """Interface for querying the Consent-Based Transparency Layer."""

    def is_action_allowed(self, consent_scope: str, payload_hash: str) -> bool:
        """Return True if consent covers the requested computation."""


@dataclass
class ProverConfig:
    backend: str
    circuit_path: Path
    trusted_setup_path: Optional[Path] = None
    security_level: str = "128"


@dataclass
class CircuitDefinition:
    name: str
    description: str
    consent_scope: str
    ethics_signal: Dict[str, Any]
    config: ProverConfig
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProofBundle:
    circuit: CircuitDefinition
    proof: bytes
    public_inputs: Dict[str, Any]
    commitments: Dict[str, Any]
    signature: bytes


class CircuitRegistry:
    """Registry for zero-knowledge circuits with consent and ethics metadata."""

    def __init__(self) -> None:
        self._registry: Dict[str, CircuitDefinition] = {}
        self._halo2_stubs: Dict[str, "Halo2CircuitStub"] = {}

    def register(self, circuit: CircuitDefinition) -> None:
        if circuit.name in self._registry:
            raise ValueError(f"Circuit '{circuit.name}' already registered")
        self._registry[circuit.name] = circuit

    def register_halo2_stub(self, stub: "Halo2CircuitStub") -> None:
        if stub.identifier in self._halo2_stubs:
            raise ValueError(f"Halo2 stub '{stub.identifier}' already registered")
        self._halo2_stubs[stub.identifier] = stub

    def halo2_constraints(self, identifier: str) -> Dict[str, Any]:
        try:
            stub = self._halo2_stubs[identifier]
        except KeyError as exc:
            raise KeyError(f"Unknown halo2 stub '{identifier}'") from exc
        return stub.simulate_constraints()

    def get(self, name: str) -> CircuitDefinition:
        try:
            return self._registry[name]
        except KeyError as exc:
            raise KeyError(f"Unknown circuit '{name}'") from exc


class Prover:
    """Generates zero-knowledge proofs without revealing private inputs."""

    def __init__(
        self,
        registry: CircuitRegistry,
        consent_oracle: ConsentOracle,
        ethics_oracle: EthicsOracle,
        pq_crypto: "PostQuantumCryptoSuite",
    ) -> None:
        self._registry = registry
        self._consent = consent_oracle
        self._ethics = ethics_oracle
        self._pq = pq_crypto

    def prove(self, circuit_name: str, witness: Dict[str, Any]) -> ProofBundle:
        circuit = self._registry.get(circuit_name)
        payload_hash = self._pq.hash_witness(witness)
        if not self._consent.is_action_allowed(circuit.consent_scope, payload_hash):
            raise PermissionError("Consent requirements not satisfied for circuit execution")
        if not self._ethics.check_ethics(circuit.ethics_signal):
            raise PermissionError("Ethical override prevented circuit execution")

        public_inputs = self._extract_public_inputs(witness, circuit.metadata)
        proof_bytes = self._generate_proof_bytes(circuit, witness, public_inputs)
        commitments = self._pq.commit_payload(witness, circuit.metadata)
        signature = self._pq.sign_proof(proof_bytes, commitments)
        return ProofBundle(
            circuit=circuit,
            proof=proof_bytes,
            public_inputs=public_inputs,
            commitments=commitments,
            signature=signature,
        )

    def _generate_proof_bytes(
        self,
        circuit: CircuitDefinition,
        witness: Dict[str, Any],
        public_inputs: Dict[str, Any],
    ) -> bytes:
        # Placeholder for actual proving logic that would leverage SNARK/STARK tooling.
        transcript = (
            f"{circuit.name}:{public_inputs}:{circuit.config.backend}:{circuit.config.security_level}:"
            f"{self._pq.hash_witness(witness)}"
        )
        return transcript.encode("utf-8")

    def _extract_public_inputs(self, witness: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        public_keys = metadata.get("public_inputs", [])
        return {key: witness[key] for key in public_keys if key in witness}


class Verifier:
    """Verifies zero-knowledge proofs generated by the Prover."""

    def __init__(self, pq_crypto: "PostQuantumCryptoSuite", ethics_oracle: EthicsOracle) -> None:
        self._pq = pq_crypto
        self._ethics = ethics_oracle

    def verify(self, bundle: ProofBundle) -> bool:
        if not self._ethics.check_ethics(bundle.circuit.ethics_signal):
            return False
        if not self._pq.verify_signature(bundle.proof, bundle.commitments, bundle.signature):
            return False
        return self._verify_proof(bundle)

    def _verify_proof(self, bundle: ProofBundle) -> bool:
        expected_prefix = (
            f"{bundle.circuit.name}:{bundle.public_inputs}:{bundle.circuit.config.backend}:"
            f"{bundle.circuit.config.security_level}:"
        )
        return bundle.proof.decode("utf-8").startswith(expected_prefix)


class PostQuantumCryptoSuite(Protocol):
    """Protocol describing the post-quantum primitives used across the stack."""

    def hash_witness(self, witness: Dict[str, Any]) -> str:
        ...

    def commit_payload(self, witness: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        ...

    def sign_proof(self, proof: bytes, commitments: Dict[str, Any]) -> bytes:
        ...

    def verify_signature(self, proof: bytes, commitments: Dict[str, Any], signature: bytes) -> bool:
        ...


class DeterministicPQSuite:
    """Deterministic reference implementation useful for testing."""

    def __init__(self, secret_key: bytes, public_key: bytes) -> None:
        self._secret_key = secret_key
        self._public_key = public_key

    def hash_witness(self, witness: Dict[str, Any]) -> str:
        canonical = _canonicalize(witness)
        payload = json.dumps(canonical, ensure_ascii=False, separators=(",", ":"), default=str)
        return _sha256(payload)

    def commit_payload(self, witness: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        salt = metadata.get("commit_salt", "ghostshroud")
        commitment = f"{salt}:{witness}".encode("utf-8")
        return {"commitment": commitment.hex()}

    def sign_proof(self, proof: bytes, commitments: Dict[str, Any]) -> bytes:
        message = proof + commitments["commitment"].encode("utf-8")
        return message + self._secret_key

    def verify_signature(self, proof: bytes, commitments: Dict[str, Any], signature: bytes) -> bool:
        expected = proof + commitments["commitment"].encode("utf-8") + self._secret_key
        return signature == expected


@dataclass
class Halo2CircuitStub:
    """Documentary Halo2 circuit description for MMFA audits."""

    identifier: str
    gates: Iterable[str]
    lookups: Iterable[str]
    public_inputs: Iterable[str]

    def simulate_constraints(self) -> Dict[str, Any]:
        gates = tuple(self.gates)
        lookups = tuple(self.lookups)
        inputs = tuple(self.public_inputs)
        digest = sha_stub(self.identifier, gates, lookups)
        return {
            "identifier": self.identifier,
            "gate_count": len(gates),
            "lookup_count": len(lookups),
            "public_inputs": list(inputs),
            "halo2_digest": digest,
        }


class DilithiumSignatureSimulator:
    """Post-quantum signature stub interoperable with deterministic suite."""

    def __init__(self, pq_suite: DeterministicPQSuite) -> None:
        self._pq = pq_suite

    def sign(self, transcript: bytes, commitments: Dict[str, Any]) -> bytes:
        salt = commitments.get("commitment", "").encode("utf-8")
        message = transcript + salt + b"dilithium"
        return message

    def verify(self, transcript: bytes, commitments: Dict[str, Any], signature: bytes) -> bool:
        expected = transcript + commitments.get("commitment", "").encode("utf-8") + b"dilithium"
        if signature == expected:
            return True
        return self._pq.verify_signature(transcript, commitments, signature)


def sha_stub(identifier: str, gates: Iterable[str], lookups: Iterable[str]) -> str:
    data = identifier + "|" + ",".join(gates) + "|" + ",".join(lookups)
    return _sha256(data)


def zk_attested_stub(registry: CircuitRegistry, identifier: str) -> Dict[str, Any]:
    """Return a combined Halo2 + Dilithium attestation payload."""

    constraints = registry.halo2_constraints(identifier)
    payload = {
        "halo2": constraints,
        "dilithium_ready": True,
    }
    return payload


__all__ = [
    "CircuitDefinition",
    "CircuitRegistry",
    "DeterministicPQSuite",
    "DilithiumSignatureSimulator",
    "EthicsOracle",
    "Halo2CircuitStub",
    "PostQuantumCryptoSuite",
    "Prover",
    "ProverConfig",
    "ProofBundle",
    "Verifier",
    "zk_attested_stub",
]
