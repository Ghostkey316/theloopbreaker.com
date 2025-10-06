"""Tests for ``vaultfire.signals.activate_sync_trigger``."""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import pytest


@pytest.fixture
def signals_fixture(monkeypatch, tmp_path):
    registry = tmp_path / "registry.json"
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("VAULTFIRE_SYNC_TRIGGER_PATH", str(registry))
    monkeypatch.setenv("VAULTFIRE_GOVERNANCE_LEDGER_PATH", str(ledger))
    sys.modules.pop("vaultfire.signals", None)
    module = importlib.import_module("vaultfire.signals")
    monkeypatch.setattr(module, "log_signal", lambda *_, **__: None)
    return module, registry, ledger


def _read_json(path: Path):
    return json.loads(path.read_text())


def test_activate_sync_trigger_creates_registry_entry(signals_fixture):
    module, registry_path, ledger_path = signals_fixture
    module._current_timestamp = lambda: "2024-06-10T00:00:00+00:00"

    record = module.activate_sync_trigger(
        user_tag="Ghostkey316",
        platform="X",
        sync_type="Passive Signal Tracking",
        notify_on_likes=True,
        notify_on_tags=True,
        ledger_tie=True,
    )

    registry = _read_json(registry_path)
    key = "Ghostkey316@x"
    assert key in registry
    assert registry[key]["status"] == "active"
    assert record["ledger_reference"] == "2024-06-10T00:00:00+00:00"

    ledger = _read_json(ledger_path)
    assert ledger[-1]["type"] == "sync-trigger"
    assert ledger[-1]["details"]["registry_key"] == key


def test_activate_sync_trigger_updates_existing_entry(signals_fixture):
    module, registry_path, _ = signals_fixture

    module._current_timestamp = lambda: "2024-06-10T01:00:00+00:00"
    module.activate_sync_trigger(
        user_tag="Ghostkey316",
        platform="X",
        sync_type="Passive Signal Tracking",
        notify_on_likes=True,
        notify_on_tags=True,
        ledger_tie=False,
    )

    module._current_timestamp = lambda: "2024-06-10T02:00:00+00:00"
    record = module.activate_sync_trigger(
        user_tag="Ghostkey316",
        platform="X",
        sync_type="Passive Signal Tracking",
        notify_on_likes=False,
        notify_on_tags=False,
        ledger_tie=False,
    )

    registry = _read_json(registry_path)
    key = "Ghostkey316@x"
    assert registry[key]["notify_on_likes"] is False
    assert registry[key]["notify_on_tags"] is False
    assert record["activated_at"] == "2024-06-10T02:00:00+00:00"


def test_activate_sync_trigger_accepts_int_bool(signals_fixture):
    module, _, _ = signals_fixture
    module._current_timestamp = lambda: "2024-06-10T03:00:00+00:00"

    record = module.activate_sync_trigger(
        user_tag="Ghostkey316",
        platform="X",
        sync_type="Passive Signal Tracking",
        notify_on_likes=1,
        notify_on_tags=0,
        ledger_tie=0,
    )

    assert record["notify_on_likes"] is True
    assert record["notify_on_tags"] is False
    assert "ledger_reference" not in record
