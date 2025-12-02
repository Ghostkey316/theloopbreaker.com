from __future__ import annotations

import json
from pathlib import Path

import pytest

from vaultfire.quantum import (
    MoralSpineMirrorTest,
    QuantumDriftBuffer,
    VaultfireDNAHash,
    ZKSNARKLoopVerifier,
)


def test_quantum_drift_buffer_sliding_window():
    buffer = QuantumDriftBuffer(window=2, noise_guard=0.1)
    first = buffer.record_drift("echo", {"delta": 0.2}, severity=0.4)
    second = buffer.record_drift("echo", {"delta": 0.4}, severity=0.6)
    third = buffer.record_drift("echo", {"delta": 0.8}, severity=0.8)

    status = buffer.status()
    assert status["sample_count"] == 2
    assert status["events"][0]["checksum"] == second.checksum
    assert status["events"][1]["checksum"] == third.checksum
    assert status["drift_checksum"]


@pytest.mark.parametrize("claim_type, payload_key", [("PoL", "liveness_pulse"), ("PoA", "action_commitment")])
def test_zksnark_loop_verifier_claims(claim_type: str, payload_key: str):
    verifier = ZKSNARKLoopVerifier()
    payload = {payload_key: "present", "orbit": "vaultfire"}
    proof = verifier.verify_loop_claim(
        "claim-001",
        claim_type=claim_type,
        payload=payload,
        commitments={"pqc_signature": "sig", "integrity_commitment": "root"},
    )

    assert proof.claim_type == claim_type.upper()
    assert proof.verified is True
    assert len(proof.loop_hash) == 64
    assert proof.zk_proof.startswith("zkloop-")


def test_moral_spine_mirror_and_dna_manifest(tmp_path: Path):
    mirror = MoralSpineMirrorTest()
    signals = {"empathy": True, "safety": 0.9, "transparency": "documented"}
    mirror_result = mirror.evaluate("Ghostkey", signals)
    assert mirror_result.moral_score >= 0.5

    buffer = QuantumDriftBuffer(window=3)
    buffer.record_drift("pulse", {"vector": 0.5}, severity=0.3)
    drift_status = buffer.status()

    verifier = ZKSNARKLoopVerifier()
    loop_proof = verifier.verify_loop_claim(
        "claim-002",
        claim_type="PoA",
        payload={"action_commitment": True},
        commitments={"pqc_signature": "sig", "integrity_commitment": "root"},
    ).to_dict()

    dna = VaultfireDNAHash()
    manifest = dna.genesis_signature(
        subject="Ghostkey",
        anchor="Vaultfire-Genesis",
        drift_buffer=drift_status,
        loop_proof=loop_proof,
        moral_mirror=mirror_result.to_dict(),
    )
    output_path = dna.export(manifest, path=tmp_path / "dna_signature.json")

    saved = json.loads(output_path.read_text())
    assert saved["dna_hash"] == manifest.dna_hash
    assert saved["subject"] == "Ghostkey"
