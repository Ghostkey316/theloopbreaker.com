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
