"""Tests for the ``vaultfire.growth.activate_quantum_loop`` helper."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from vaultfire import growth


def test_activate_quantum_loop_records_entry(tmp_path, monkeypatch):
    log_path = tmp_path / "quantum_loop.json"
    monkeypatch.setenv("VAULTFIRE_QUANTUM_LOOP_LOG_PATH", str(log_path))

    signal_calls: list[tuple[str, dict | None]] = []

    def fake_log_signal(event: str, meta: dict | None = None) -> None:
        signal_calls.append((event, meta))

    monkeypatch.setattr(growth, "log_signal", fake_log_signal)

    entry = growth.activate_quantum_loop(
        user=" Ghostkey-316 ",
        reinforcement_type="belief-reward-feedback",
        upgrade_schedule="continuous ",
        validation_method="proof-of-loyalty",
        anchor_roles=[" Ghostkey ", "Architect", "Moral Sentinel", "Ghostkey"],
        loop_visibility="private",
    )

    assert entry["user"] == "Ghostkey-316"
    assert entry["reinforcement_type"] == "belief-reward-feedback"
    assert entry["upgrade_schedule"] == "continuous"
    assert entry["anchor_roles"] == ["Ghostkey", "Architect", "Moral Sentinel"]
    assert entry["status"] == "pending-verification"
    assert entry["verification"]["method"] == "proof-of-loyalty"

    assert log_path.exists()
    log_data = json.loads(Path(log_path).read_text())
    assert log_data[-1]["user"] == "Ghostkey-316"
    assert log_data[-1]["anchor_roles"] == ["Ghostkey", "Architect", "Moral Sentinel"]

    assert signal_calls
    event, meta = signal_calls[-1]
    assert event == "quantum-loop.activation"
    assert meta is not None
    assert meta["user"] == "Ghostkey-316"
    assert meta["anchor_roles"] == ["Ghostkey", "Architect", "Moral Sentinel"]


def test_activate_quantum_loop_requires_roles(tmp_path, monkeypatch):
    monkeypatch.setenv("VAULTFIRE_QUANTUM_LOOP_LOG_PATH", str(tmp_path / "noop.json"))

    with pytest.raises(ValueError):
        growth.activate_quantum_loop(
            user="Ghostkey-316",
            reinforcement_type="belief-reward-feedback",
            upgrade_schedule="continuous",
            validation_method="proof-of-loyalty",
            anchor_roles=[],
            loop_visibility="private",
        )
