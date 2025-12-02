from datetime import datetime

import pytest

from vaultfire.loyalty_engine import LoyaltyEngine


def test_multiplier_scales_with_pop_tier_and_streak():
    engine = LoyaltyEngine(clock=lambda: datetime(2024, 1, 1))

    baseline = engine.calculate_multiplier(
        "validator-1", pop_tier=1, belief_sync_streak=0, recall_precision=1.0
    )
    advanced = engine.calculate_multiplier(
        "validator-1", pop_tier=3, belief_sync_streak=10, recall_precision=1.0
    )

    assert advanced.net_multiplier > baseline.net_multiplier
    assert advanced.base_multiplier > baseline.base_multiplier
    assert advanced.streak_amplifier > baseline.streak_amplifier


def test_recall_penalty_applies_decay_weighting():
    engine = LoyaltyEngine(clock=lambda: datetime(2024, 1, 1))

    perfect = engine.calculate_multiplier(
        "validator-2", pop_tier=2, belief_sync_streak=3, recall_history=[1, 1, 1]
    )
    degraded = engine.calculate_multiplier(
        "validator-2", pop_tier=2, belief_sync_streak=3, recall_history=[1, 0.5, 0]
    )

    assert degraded.net_multiplier < perfect.net_multiplier
    assert degraded.recall_penalty < perfect.recall_penalty


def test_yield_class_boundaries():
    assert LoyaltyEngine.classify_yield_class(0.99) == "Bronze"
    assert LoyaltyEngine.classify_yield_class(1.1) == "Silver"
    assert LoyaltyEngine.classify_yield_class(1.3) == "Gold"
    assert LoyaltyEngine.classify_yield_class(1.55) == "Sovereign"
