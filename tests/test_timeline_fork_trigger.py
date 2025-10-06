from __future__ import annotations

from vaultfire.protocol.conscious_state import ConsciousStateEngine
from vaultfire.protocol.moral_fork import MoralForkEngine
from vaultfire.protocol.signal_echo import SignalEchoEngine
from vaultfire.protocol.timeflare import TimeFlare


def test_conscious_state_engine_emits_timeflare_triggers(tmp_path) -> None:
    signal_engine = SignalEchoEngine()
    timeflare = TimeFlare(ledger_path=tmp_path / "timeflare.json")
    fork_engine = MoralForkEngine(timeflare=timeflare)
    conscious = ConsciousStateEngine(
        signal_engine=signal_engine,
        fork_engine=fork_engine,
        drift_threshold=0.1,
        deviation_threshold=0.1,
    )

    first = conscious.capture(
        "session-1",
        belief_score=0.9,
        mission_score=0.92,
        emotion="steady",
        ethic="aligned",
        intensity=0.8,
        tags=("baseline",),
    )
    assert first.status == "stable"
    assert first.fork is None

    second = conscious.capture(
        "session-1",
        belief_score=0.55,
        mission_score=0.58,
        emotion="concern",
        ethic="drift",
        intensity=0.4,
        tags=("alert",),
    )
    assert second.status == "fork-candidate"
    assert second.fork is not None
    assert second.fork.branch in {"monitor", "divergent"}

    ledger_entries = timeflare.load()
    assert ledger_entries, "Fork candidate should be written to the ledger"
    assert ledger_entries[-1]["interaction_id"] == "session-1"
