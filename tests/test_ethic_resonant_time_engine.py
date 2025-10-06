"""Unit tests for the Ethic Resonant Time Engine module."""

from vaultfire.modules.ethic_resonant_time_engine import (
    EthicResonantTimeEngine,
    MoralMomentumIndex,
)


def test_moral_momentum_index_weights_are_non_negative_when_positive_actions():
    index = MoralMomentumIndex()
    index.update({"type": "support"})
    index.update({"type": "sacrifice"})

    assert index.get_score() == 8


def test_time_engine_tracks_history_and_tempo():
    engine = EthicResonantTimeEngine(user_id="ghostkey316")
    engine.register_action({"type": "support"})
    engine.register_action({"type": "selfish"})
    engine.register_action({"type": "betrayal"})

    assert engine.current_tempo() == "slow"
    history = engine.review_history()
    assert len(history) == 3
    assert history[0]["type"] == "support"


def test_time_engine_timecheck_and_pulse_report_metadata():
    engine = EthicResonantTimeEngine(user_id="ghostkey316")
    engine.register_action({"type": "support", "weight": 2})
    engine.register_action({"type": "betrayal", "weight": 1})

    report = engine.timecheck()
    assert report["metadata"]["first_of_its_kind"] is True
    assert report["identity"]["ens"] == "ghostkey316.eth"

    pulse = engine.pulse()
    assert "pulse" in pulse
    assert pulse["metadata"]["identity"]["wallet"] == "bpow20.cb.id"
