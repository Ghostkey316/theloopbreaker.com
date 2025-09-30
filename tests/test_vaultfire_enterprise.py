"""Enterprise-readiness tests for the upgraded Vaultfire core."""

from __future__ import annotations

import json
import sqlite3
import sys
import types
from pathlib import Path

import pytest

import vaultfire_core as core


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    monkeypatch.delenv("VAULTFIRE_CONFIG_PATH", raising=False)
    core.reset_vaultfire_state()
    yield
    core.reset_vaultfire_state()


def _write_config(tmp_path: Path, payload: dict) -> Path:
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps(payload))
    return config_path


def test_sync_purpose_file_backend_rotation(tmp_path, monkeypatch):
    purpose_path = tmp_path / "purpose.json"
    config_path = _write_config(
        tmp_path,
        {
            "purpose_map_path": str(purpose_path),
            "use_database": False,
            "max_purpose_records": 3,
            "audit_enabled": False,
        },
    )
    monkeypatch.setenv("VAULTFIRE_CONFIG_PATH", str(config_path))
    core.reset_vaultfire_state()

    for index in range(5):
        core.sync_purpose("domain", f"trait-{index}", "role")

    data = json.loads(purpose_path.read_text())
    records = data["records"]
    assert len(records) == 3
    assert [record["trait"] for record in records] == ["trait-2", "trait-3", "trait-4"]


def test_sync_purpose_sqlite_backend(tmp_path, monkeypatch):
    db_path = tmp_path / "vaultfire.db"
    config_path = _write_config(
        tmp_path,
        {
            "use_database": True,
            "database_url": f"sqlite:///{db_path}",
            "max_purpose_records": 2,
            "audit_enabled": False,
        },
    )
    monkeypatch.setenv("VAULTFIRE_CONFIG_PATH", str(config_path))
    core.reset_vaultfire_state()

    for index in range(3):
        core.sync_purpose("domain", f"trait-{index}", "role")

    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            "SELECT trait FROM purpose_records ORDER BY id"
        ).fetchall()
    assert len(rows) == 2
    traits = [row[0] for row in rows]
    assert traits == ["trait-1", "trait-2"]


def test_protocol_notify_enriches_payload_and_audits(tmp_path, monkeypatch):
    audit_path = tmp_path / "audit.jsonl"
    config_path = _write_config(
        tmp_path,
        {
            "audit_enabled": True,
            "audit_log_path": str(audit_path),
            "notify_channel": "enterprise-channel",
            "environment": "staging",
        },
    )
    monkeypatch.setenv("VAULTFIRE_CONFIG_PATH", str(config_path))
    core.reset_vaultfire_state()

    captured = {}
    module = types.ModuleType("ghostkey_trader_notifications")

    def _notify(event, payload):
        captured["event"] = event
        captured["payload"] = payload

    module.notify_event = _notify
    sys.modules["ghostkey_trader_notifications"] = module

    try:
        core.protocol_notify("test.event", {"hello": "world"})
    finally:
        sys.modules.pop("ghostkey_trader_notifications", None)

    assert captured["event"] == "test.event"
    envelope = captured["payload"]
    assert envelope["channel"] == "enterprise-channel"
    assert envelope["environment"] == "staging"
    assert envelope["payload"] == {"hello": "world"}

    audit_lines = audit_path.read_text().strip().splitlines()
    assert len(audit_lines) == 1
    audit_entry = json.loads(audit_lines[0])
    assert audit_entry["event"] == "test.event"

