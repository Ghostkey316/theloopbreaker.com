from __future__ import annotations

import json
from pathlib import Path

from vaultfire.ghost_audit import GhostAuditLogger


def read_latest_record(path: Path) -> dict:
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    return json.loads(lines[-1])


def test_log_simulation_writes_publishable_record(tmp_path):
    log_path = tmp_path / "ghost_audit.jsonl"
    logger = GhostAuditLogger(log_path=log_path, default_validators=("validator.one",))

    record = logger.log_simulation(
        protocol_name="partner_activation",
        scenario="pilot-001",
        decision_tree={"nodes": [{"id": "step-1", "outcome": "pass"}]},
        performance={"duration_ms": 12.5, "success": True},
        run_context={"partner_id": "pilot-001", "wallets": ["0xabc"]},
        outcome={"status": "PASS", "failures": []},
        protocol_version="activation.v1",
    )

    assert log_path.exists(), "ghost audit log should be persisted"
    persisted = read_latest_record(log_path)
    assert persisted["run"]["protocol"]["name"] == "partner_activation"
    assert persisted["run"]["scenario"] == "pilot-001"
    assert persisted["performance"]["duration_ms"] == 12.5
    assert persisted["validators"][0]["validator"] == "validator.one"
    assert "signature" in persisted["validators"][0]
    assert persisted["attestation"]["digest"]
    # The return value mirrors persisted structure for callers who need it.
    assert record["run"]["id"] == persisted["run"]["id"]


def test_log_simulation_redacts_sensitive_fields(tmp_path):
    log_path = tmp_path / "ghost_audit.jsonl"
    logger = GhostAuditLogger(log_path=log_path)

    record = logger.log_simulation(
        protocol_name="consent_protocol",
        scenario="pilot-002",
        decision_tree={"nodes": [{"wallets": ["0xaaa", "0xbbb"]}]},
        performance={"duration_ms": 4.2, "success": False},
        run_context={"wallets": ["0xaaa", "0xbbb"], "partner_contact": "ops@pilot.io"},
        outcome={"wallets": ["0xaaa"], "status": "FAIL"},
        redact_sensitive=True,
    )

    persisted = read_latest_record(log_path)
    assert persisted["redacted"] is True
    assert record["context"]["wallets"] == ["***redacted***", "***redacted***"]
    assert persisted["context"]["partner_contact"] == "***redacted***"
    node_wallets = persisted["decision_tree"]["nodes"][0]["wallets"]
    assert node_wallets == ["***redacted***", "***redacted***"]
