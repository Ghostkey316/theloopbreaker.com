from __future__ import annotations

from pathlib import Path

from vaultfire.mission import LedgerMetadata, MissionLedger


def test_mission_ledger_records_partner_metadata(tmp_path):
    ledger_path = tmp_path / "mission-ledger.jsonl"
    ledger = MissionLedger(path=ledger_path, component="secure-ops")

    metadata = LedgerMetadata(
        partner_id="partner-1",
        narrative="Partner narrative capture",
        diligence_artifacts=("artifact://due-diligence",),
        region="us-east-1",
        tags=("narrative", "diligence"),
    )
    record = ledger.append(
        "core.purpose",
        {"key": "value", "confidence": 0.98},
        metadata,
    )

    fetched = ledger.lookup(record.record_id)
    assert fetched is not None
    assert fetched.metadata.narrative == "Partner narrative capture"
    assert ledger.verify_artifact("artifact://due-diligence") is True

    regional = ledger.regional_snapshot("us-east-1")
    assert regional[0]["record_id"] == record.record_id
    assert regional[0]["component"] == "secure-ops"
