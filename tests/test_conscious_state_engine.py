from __future__ import annotations

from vaultfire.modules.vaultfire_protocol_stack import ConsciousStateEngine


def test_conscious_state_engine_records_actions_and_diagnostics() -> None:
    engine = ConsciousStateEngine()
    first = engine.record_action({"ethic": "support", "weight": 2.0, "note": "assist"})
    second = engine.record_action({"ethic": "betrayal", "weight": 1.5, "note": "conflict"})

    assert first.approved is True
    assert second.approved is False

    ledger = engine.ledger()
    assert len(ledger) == 2
    assert ledger[0].payload["identity"]["ens"] == "ghostkey316.eth"

    health = engine.belief_health()
    assert 0.0 <= health <= 1.0

    diagnostics = engine.sync_diagnostics()
    assert diagnostics["actions"] == 2
    assert diagnostics["identity"]["wallet"] == "bpow20.cb.id"
    assert diagnostics["last_action"]["note"] == "conflict"
