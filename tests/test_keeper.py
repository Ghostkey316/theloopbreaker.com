from pathlib import Path

from vaultfire.quantum.sovereign_layer import ZKKeeper


def test_keeper_encrypts_and_stores_proof(tmp_path):
    container = tmp_path / "zk_keeper_container.json"
    keeper = ZKKeeper(container)

    proof = keeper.generate_alignment_proof("DNA-ghost-316", ["Integrity", "Clarity", "Courage"])
    stored = keeper.store_proof(proof)

    assert stored["proof_id"] == proof.proof_id
    assert stored["signature_commitment"].startswith("poseidon-")
    payload = container.read_text()
    assert "encrypted_payload" in payload

    observed = "poseidon-tampered"
    rollback = keeper.rollback_if_tampered(proof.signature_commitment, observed)
    assert rollback["status"] == "rollback"
    assert rollback["restored_signature"] == proof.signature_commitment

    validated = keeper.rollback_if_tampered(proof.signature_commitment, proof.signature_commitment)
    assert validated["status"] == "validated"
