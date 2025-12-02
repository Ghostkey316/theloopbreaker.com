import json
from pathlib import Path

from quantum_expansion_v2 import codex_guard, ethos_oracle, link_proof, proof_of_person, watchtower


def test_chainlinker_verifier_roundtrip(tmp_path: Path):
    verifier = link_proof.ChainlinkerVerifier(allowed_identity="ghostkey-316-anchor")
    proof = verifier.generate_proof("base")
    path = tmp_path / "proof.json"
    link_proof.export_proof(proof, path)

    loaded = link_proof.load_proof(path)
    assert verifier.verify(loaded)
    assert loaded.domain == "base"


def test_ethos_oracle_exports_scores(tmp_path: Path):
    oracle = ethos_oracle.EthosOracle(base_score=55)
    oracle.record_event("ghostkey-316", "base", weight=10, description="anchor detected")
    export_path = tmp_path / "ethos.json"
    scores = oracle.export_json(export_path)

    loaded = json.loads(export_path.read_text())
    assert scores == loaded
    assert scores["ghostkey-316"] == 65


def test_watchtower_dispatch_creates_hashes(tmp_path: Path):
    relay_path = tmp_path / "encrypted_signal.json"
    tower = watchtower.QuantumWatchtower(relay_path=relay_path)
    tower.observe_github("ghostkey-316-vaultfire-init")
    tower.observe_zora("Vaultfire")
    tower.observe_base("ghostkey-anchor")

    digests = tower.dispatch_encrypted_signal()
    stored = json.loads(relay_path.read_text())

    assert len(digests) == 3
    assert stored["ghostkey_identity"] == "bpow20.cb.id"
    assert stored["signals"] == digests


def test_bio_lock_generates_token(tmp_path: Path):
    verifier = proof_of_person.BioLockVerifier(salt="unit-test")
    proof = verifier.generate_proof(entropy="abc123")
    token = verifier.store_identity_token(proof, path=tmp_path / "bio_soul.zksig")

    assert token["ghostkey"] == "bpow20.cb.id"
    assert Path(tmp_path / "bio_soul.zksig").exists()


def test_codex_guard_alignment(tmp_path: Path, monkeypatch):
    log_path = tmp_path / "violations.jsonl"
    monkeypatch.setattr(codex_guard, "VIOLATION_LOG", log_path)

    engine = codex_guard.CodexValidationEngine()
    aligned = engine.evaluate("Ensure consent and safety before deployment.")
    assert aligned.is_aligned

    flagged = engine.evaluate("Missing closing bracket[")
    assert not flagged.logic_valid
    assert log_path.exists()
    logs = log_path.read_text().strip().splitlines()
    assert any("logic_failure" in line for line in logs)
