from __future__ import annotations

import json

from vaultfire.dependencies import regenerate_service_artifacts, render_service_map


def test_regenerate_service_artifacts(tmp_path, monkeypatch):
    service_map_path = tmp_path / "service_map.json"
    sla_path = tmp_path / "docs" / "SLA.md"
    codex_path = tmp_path / "codex" / "ledger.jsonl"
    ledger_path = tmp_path / "mission-ledger.jsonl"
    monkeypatch.setenv("VAULTFIRE_MISSION_LEDGER_PATH", str(ledger_path))

    summary = regenerate_service_artifacts(
        service_map_path=service_map_path,
        sla_path=sla_path,
        codex_path=codex_path,
    )

    assert service_map_path.exists()
    assert json.loads(service_map_path.read_text()) == render_service_map()
    assert sla_path.exists()
    assert "Vaultfire Protocol SLA" in sla_path.read_text()

    ledger_entries = [json.loads(line) for line in ledger_path.read_text().splitlines() if line.strip()]
    assert ledger_entries, "ledger should capture the SLA revision"
    assert ledger_entries[-1]["component"] == "SLA_revision_log"

    codex_entries = [json.loads(line) for line in codex_path.read_text().splitlines() if line.strip()]
    assert codex_entries[-1]["event"] == "sla_revision"
    assert codex_entries[-1]["record_id"] == summary["record_id"]
