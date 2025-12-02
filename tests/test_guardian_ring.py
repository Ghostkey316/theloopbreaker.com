from __future__ import annotations

from pathlib import Path

import pytest

from vaultfire.zk import GuardianRingVerifier


@pytest.fixture()
def verifier() -> GuardianRingVerifier:
    return GuardianRingVerifier(backend="snarkjs")


def test_guardian_ring_build_and_verify(verifier: GuardianRingVerifier):
    proof = verifier.build_proof(spine_hash="0xabc123", yield_receipt="yield-777", loop_nonce=42)

    assert verifier.verify(proof) is True

    tampered = proof.to_dict()
    tampered["alignment"] = "0" * len(proof.alignment)
    assert verifier.verify(tampered) is False

    tampered_backend = proof.to_dict()
    tampered_backend["backend"] = "pysnark"
    assert verifier.verify(tampered_backend) is False


def test_guardian_ring_circuit_includes_poseidon():
    circuit_path = Path("vaultfire/zk/guardian_ring.circom")
    content = circuit_path.read_text()

    assert "Poseidon" in content
    assert "alignment" in content
