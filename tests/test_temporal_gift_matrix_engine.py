from __future__ import annotations

from datetime import datetime, timezone
from importlib import import_module

from vaultfire.protocol.moral_fork import TimelineFork
from vaultfire.protocol.signal_echo import SignalEchoEngine
from vaultfire.protocol.timeflare import TimeFlare
from vaultfire.quantum.hashmirror import QuantumHashMirror

yield_module = import_module("vaultfire.yield")
PulseSync = getattr(yield_module, "PulseSync")
TemporalGiftMatrixEngine = getattr(yield_module, "TemporalGiftMatrixEngine")


def _bootstrap_timeflare(tmp_path) -> TimeFlare:
    ledger_path = tmp_path / "timeflare.json"
    timeflare = TimeFlare(ledger_path=ledger_path)
    fork = TimelineFork(
        fork_id="fork-001",
        interaction_id="interaction-1",
        branch="monitor",
        priority="medium",
        ethic_score=0.72,
        signal_weight=0.66,
        alignment_bias=0.35,
        alignment_history=("aligned", "mission"),
        created_at=datetime.now(timezone.utc),
    )
    timeflare.emit(fork)
    return timeflare


def test_generate_matrix_uses_timeflare_and_signal_echo(tmp_path) -> None:
    signal_engine = SignalEchoEngine()
    signal_engine.record_frame(
        "interaction-1",
        emotion="focus",
        ethic="aligned",
        intensity=0.9,
        tags=("ally", "ethic"),
    )
    signal_engine.record_frame(
        "interaction-1",
        emotion="calm",
        ethic="support",
        intensity=0.75,
        tags=("ally",),
    )

    engine = TemporalGiftMatrixEngine(
        timeflare=_bootstrap_timeflare(tmp_path),
        signal_engine=signal_engine,
        pulse_sync=PulseSync(),
        hash_mirror=QuantumHashMirror(seed="matrix-test"),
        base_reward=150.0,
    )

    recipients = [
        {"wallet": "0xabc", "belief_multiplier": 1.1},
        {"wallet": "0xdef", "belief_multiplier": 0.85, "trajectory_bonus": 0.2},
    ]
    record = engine.generate_matrix("interaction-1", recipients)

    assert record.record_id == TemporalGiftMatrixEngine.RECORD_ID
    assert record.metadata["timeline_branch"] == "monitor"
    assert record.metadata["priority"] == "medium"
    assert len(record.allocations) == 2

    first, second = record.allocations
    assert first.identity_tag != second.identity_tag
    assert first.wallet == "0xabc"
    assert second.wallet == "0xdef"
    assert first.allocation != second.allocation
    assert first.allocation > 0
    assert second.allocation > 0

    cached = engine.record("interaction-1")
    assert cached is record
