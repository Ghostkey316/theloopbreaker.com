from __future__ import annotations

import json
import math

from vaultfire.security.fhe import AuroraFHEBackend, Ciphertext, FHEAuditArtifacts, FHECipherSuite


def test_aurora_backend_encrypts_and_decrypts_scalar():
    backend = AuroraFHEBackend()
    suite = FHECipherSuite(backend=backend)

    ciphertext = suite.encrypt_value(12.75)
    assert isinstance(ciphertext, Ciphertext)
    assert ciphertext.metadata["backend"] == backend.backend_id
    assert "nonce" in ciphertext.metadata

    value = suite.decrypt_value(ciphertext)
    assert math.isclose(value, 12.75, rel_tol=1e-6, abs_tol=1e-6)


def test_aurora_backend_supports_homomorphic_add_and_reblind():
    suite = FHECipherSuite()
    ct_one = suite.encrypt_value(5.0, metadata={"label": "a"})
    ct_two = suite.encrypt_value(7.0, metadata={"label": "b"})

    aggregate = suite.homomorphic_add(ct_one, ct_two)
    assert aggregate.metadata["type"] == "aggregate"
    assert aggregate.metadata["inputs"] == 2

    decrypted = suite.decrypt_value(aggregate)
    assert math.isclose(decrypted, 12.0, rel_tol=1e-6, abs_tol=1e-6)

    refreshed = suite.reblind(aggregate)
    assert refreshed.mask != aggregate.mask
    assert refreshed.metadata.get("reblinded") is True


def test_aurora_backend_generates_attestations():
    suite = FHECipherSuite()
    ciphertexts = [suite.encrypt_value(idx) for idx in (1.0, 2.0, 3.0)]

    attestation = suite.attest_integrity(ciphertexts)
    assert attestation["backend"] == "vaultfire.aurora-fhe-r1"
    assert attestation["count"] == 3
    assert isinstance(attestation["attestation"], str)
    assert len(attestation["attestation"]) == 64


def test_audit_mode_generates_zk_bundle(tmp_path, monkeypatch):
    monkeypatch.setenv("VAULTFIRE_MISSION_LEDGER_PATH", str(tmp_path / "mission-ledger.jsonl"))
    artifacts = FHEAuditArtifacts(
        path=tmp_path / "fhe_proof.json",
        codex_memory_path=tmp_path / "codex_memory.jsonl",
        mission_ledger_path=tmp_path / "mission-ledger.jsonl",
    )
    backend = AuroraFHEBackend(aurora_fhe_mode="audit", audit_artifacts=artifacts)
    suite = FHECipherSuite(backend=backend)

    ciphertext = suite.encrypt_value(3.5)
    assert ciphertext.metadata["audit_mode"] is True
    assert "audit_seed" in ciphertext.metadata
    assert "audit_proof" in ciphertext.metadata

    manifest = json.loads((tmp_path / "fhe_proof.json").read_text())
    assert manifest["audit_mode"] is True
    assert manifest["events"], "audit manifest should record events"
    entry = manifest["events"][-1]
    assert entry["action"] == "encrypt_scalar"
    assert entry["proof"] == ciphertext.metadata["audit_proof"]

    codex_lines = (tmp_path / "codex_memory.jsonl").read_text().splitlines()
    assert codex_lines and "fhe-audit" in codex_lines[-1]

    ledger_lines = (tmp_path / "mission-ledger.jsonl").read_text().splitlines()
    assert ledger_lines, "ledger should capture the audit summary"
