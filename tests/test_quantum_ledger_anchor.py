"""Unit tests for the Vaultfire quantum ledger anchoring module."""

from __future__ import annotations

import pytest

from vaultfire.anchor import (
    DEFAULT_PRIMARY_NETWORK,
    MissionIntegrityMonitor,
    PQCSignatureSuite,
    QuantumLedgerAnchor,
)
from vaultfire.mission import MissionLedger, MissionRecord


@pytest.fixture()
def mission_ledger(tmp_path) -> MissionLedger:
    return MissionLedger(path=tmp_path / "mission-ledger.jsonl", component="pytest")


def _write_record(ledger: MissionLedger) -> MissionRecord:
    metadata = ledger.metadata_template(
        partner_id="ghostkey.ai",
        narrative="stealth pilot calibration",
        tags=("stealth", "quantum"),
    )
    record = ledger.append(
        "mission-anchor",
        {"status": "green", "coherence": 0.997},
        metadata,
    )
    return record


def test_quantum_anchor_chain_sync(mission_ledger: MissionLedger) -> None:
    record = _write_record(mission_ledger)
    suite = PQCSignatureSuite(dilithium_key=b"d-key", kyber_key=b"k-key")
    anchor = QuantumLedgerAnchor(mission_ledger, pqc_suite=suite)

    receipts = anchor.anchor_record(record)
    assert receipts, "anchoring should yield receipts"
    networks = {receipt.network for receipt in receipts}
    assert networks == {DEFAULT_PRIMARY_NETWORK, "ethereum-mainnet", "zora-mainnet"}

    receipt_map = {receipt.network: receipt for receipt in receipts}
    for network, receipt in receipt_map.items():
        assert anchor.verify_receipt(receipt)
        state = anchor.sync_network(network)
        assert receipt.record_id in state.anchored_records
        assert state.last_anchor == receipt.anchor_hash
        assert state.zk_batch_proof is not None


def test_pqc_signature_suite_verification() -> None:
    suite = PQCSignatureSuite(dilithium_key="alpha", kyber_key="omega")
    message = b"mission integrity"
    bundle = suite.sign(message)
    assert suite.verify(message, bundle.to_dict())

    forged = bundle.to_dict()
    forged["dilithium"] = "tampered" + forged["dilithium"]
    assert not suite.verify(message, forged)


def test_quantum_anchor_rollback_recovery(mission_ledger: MissionLedger) -> None:
    record = _write_record(mission_ledger)
    anchor = QuantumLedgerAnchor(mission_ledger)

    receipts = anchor.anchor_record(record)
    base_receipt = next(receipt for receipt in receipts if receipt.network == DEFAULT_PRIMARY_NETWORK)
    assert anchor.get_receipt(DEFAULT_PRIMARY_NETWORK, record.record_id)

    rolled = anchor.rollback(DEFAULT_PRIMARY_NETWORK, record.record_id)
    assert rolled is not None
    assert anchor.get_receipt(DEFAULT_PRIMARY_NETWORK, record.record_id) is None

    recovered = anchor.recover(DEFAULT_PRIMARY_NETWORK, record.record_id)
    assert recovered is not None
    assert anchor.verify_receipt(recovered)


def test_mission_integrity_monitor_broadcasts(mission_ledger: MissionLedger) -> None:
    record = _write_record(mission_ledger)
    anchor = QuantumLedgerAnchor(mission_ledger)
    monitor = MissionIntegrityMonitor(mission_ledger, anchor)

    receipts = monitor.poll()
    assert receipts
    broadcasts = monitor.captured_broadcasts()
    assert broadcasts
    summary = broadcasts[0]
    assert summary["record_id"] == record.record_id
    assert DEFAULT_PRIMARY_NETWORK in summary["networks"]
    # Polling again should not duplicate anchors or broadcasts.
    monitor.poll()
    assert len(monitor.captured_broadcasts()) == len(broadcasts)
