from __future__ import annotations

import json

from vaultfire.mission import MissionLedger
from vaultfire.trust import record_protocol_markers


def test_record_protocol_markers(tmp_path):
    codex_path = tmp_path / "codex" / "ledger.jsonl"
    ledger_path = tmp_path / "mission-ledger.jsonl"
    ledger = MissionLedger(path=ledger_path, component="protocol-reinforcement")

    markers = [
        "fhe_proof_bundle",
        "daily_backup_complete",
    ]
    record_ids = record_protocol_markers(markers, codex_path=codex_path, mission_ledger=ledger, extra={"release": "v3.1"})
    assert len(record_ids) == len(markers)

    codex_entries = [json.loads(line) for line in codex_path.read_text().splitlines() if line.strip()]
    assert [entry["marker"] for entry in codex_entries] == markers

    ledger_entries = [json.loads(line) for line in ledger_path.read_text().splitlines() if line.strip()]
    assert len(ledger_entries) == len(markers)
    assert all(entry["component"] == "protocol-reinforcement" for entry in ledger_entries)
    assert ledger_entries[-1]["payload"]["extra"]["release"] == "v3.1"
