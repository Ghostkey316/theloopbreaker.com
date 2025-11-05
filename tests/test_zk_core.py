from __future__ import annotations

from pathlib import Path

from zk_core import (
    CircuitDefinition,
    CircuitRegistry,
    DeterministicPQSuite,
    DilithiumSignatureSimulator,
    Halo2CircuitStub,
    Prover,
    ProverConfig,
    zk_attested_stub,
)


class StubConsent:
    def is_action_allowed(self, consent_scope, payload_hash):
        return True


class StubEthics:
    def check_ethics(self, signal):
        return True


class StubPQ(DeterministicPQSuite):
    pass


def test_halo2_stub_and_attestation() -> None:
    registry = CircuitRegistry()
    registry.register_halo2_stub(
        Halo2CircuitStub(
            identifier="halo2-mission",
            gates=["range", "poseidon"],
            lookups=["rca"],
            public_inputs=["belief", "drift"],
        )
    )
    payload = zk_attested_stub(registry, "halo2-mission")
    assert payload["halo2"]["gate_count"] == 2


def test_prover_with_dilithium_simulator() -> None:
    pq = StubPQ(b"secret", b"public")
    registry = CircuitRegistry()
    registry.register(
        CircuitDefinition(
            name="belief-circuit",
            description="",
            consent_scope="belief",
            ethics_signal={"alignment": 1},
            config=ProverConfig(backend="halo2", circuit_path=Path("/tmp")),
            metadata={"public_inputs": ["value"], "commit_salt": "salt"},
        )
    )
    prover = Prover(registry, StubConsent(), StubEthics(), pq)
    bundle = prover.prove("belief-circuit", {"value": 42})
    dilithium = DilithiumSignatureSimulator(pq)
    signature = dilithium.sign(bundle.proof, bundle.commitments)
    assert dilithium.verify(bundle.proof, bundle.commitments, signature)
