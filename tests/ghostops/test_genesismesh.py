from pathlib import Path
import json

from ghostops_v1.genesismesh import GenesisMeshVerifierEngine


def test_records_and_exports_receipts(tmp_path: Path):
    store = tmp_path / "interactions.json"
    output = tmp_path / "receipts.json"
    engine = GenesisMeshVerifierEngine(store)

    engine.record_interaction("session-a", "vaultfire.core", {"event": "ping"})
    engine.record_interaction("session-a", "vaultfire.core", {"event": "pong"})

    exported_path = engine.export_receipts(output)
    receipts = json.loads(exported_path.read_text())

    roots = {entry["merkle_root"] for entry in receipts}
    assert len(roots) == 1
    assert all(GenesisMeshVerifierEngine.verify_receipt(entry) for entry in receipts)
    assert "session-a" in exported_path.read_text()


def test_receipt_verification(tmp_path: Path):
    store = tmp_path / "interactions.json"
    engine = GenesisMeshVerifierEngine(store)

    receipt = engine.record_interaction("session-b", "protocol.endpoint", {"payload": 123})

    assert engine.verify_receipt(receipt) is True

    invalid_receipt = receipt.to_dict()
    invalid_receipt["proof_path"] = ["tampered"]
    assert engine.verify_receipt(invalid_receipt) is False
