from datetime import datetime
import json

from vaultfire.pop_engine import PoPEngine, PoPUpgradeEvent


class DummyRouter:
    def __init__(self) -> None:
        self.drip_triggered = 0
        self.passive_triggered = 0

    def triggerDripRelease(self) -> None:  # pragma: no cover - simple counter
        self.drip_triggered += 1

    def activatePassiveLoop(self) -> None:  # pragma: no cover - simple counter
        self.passive_triggered += 1


def test_pop_score_calculation_and_history(tmp_path):
    cache_path = tmp_path / "pop_cache.json"
    engine = PoPEngine(cache_path=cache_path, time_source=lambda: datetime(2024, 1, 1, 0, 0, 0))

    vaultproofs = [
        {"format": ".vaultproof", "verified": True, "confidence": 1.0},
        {"format": ".vaultproof", "verified": True, "confidence": 0.85},
    ]
    result = engine.calculate_score(
        "validator-abc",
        vaultproofs=vaultproofs,
        recall_strength=0.82,
        amplifier_streak=4,
        vaultloop_hash="loop-hash-001",
    )

    assert 0 <= result.score <= 10
    assert result.tier == PoPEngine.classify_tier(result.score)

    cache_data = json.loads(cache_path.read_text())
    assert "validator-abc" in cache_data
    assert cache_data["validator-abc"][-1]["vaultloop_hash"] == "loop-hash-001"


def test_tier_classification_edges():
    assert PoPEngine.classify_tier(1.99) == 0
    assert PoPEngine.classify_tier(2.0) == 1
    assert PoPEngine.classify_tier(4.9) == 1
    assert PoPEngine.classify_tier(5.0) == 2
    assert PoPEngine.classify_tier(7.4) == 2
    assert PoPEngine.classify_tier(7.5) == 3


def test_reward_hooks_and_upgrade_events(tmp_path):
    router = DummyRouter()
    now = datetime(2024, 1, 2, 0, 0, 0)
    engine = PoPEngine(cache_path=tmp_path / "pop_cache.json", signal_router=router, time_source=lambda: now)

    initial = engine.calculate_score(
        "validator-upgrade",
        vaultproofs=[],
        recall_strength=0.1,
        amplifier_streak=0,
        vaultloop_hash="loop-low",
    )
    assert initial.tier == 0
    assert initial.upgrade_event is None
    assert router.drip_triggered == 0
    assert router.passive_triggered == 0

    upgraded = engine.calculate_score(
        "validator-upgrade",
        vaultproofs=[{"format": ".vaultproof", "verified": True, "confidence": 1.0}],
        recall_strength=0.95,
        amplifier_streak=5,
        vaultloop_hash="loop-upgraded",
    )
    assert upgraded.tier == 3
    assert isinstance(upgraded.upgrade_event, PoPUpgradeEvent)
    assert upgraded.upgrade_event.previous_tier == initial.tier
    assert router.drip_triggered == 1
    assert router.passive_triggered == 1
