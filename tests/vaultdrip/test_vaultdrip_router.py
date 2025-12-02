from datetime import datetime

from vaultfire.pop_engine import PoPEngine, PoPScoreResult, PoPUpgradeEvent
from vaultfire.vaultdrip_router import VaultdripRouter


def _score_result(validator: str, previous: int, new: int) -> PoPScoreResult:
    timestamp = datetime(2024, 1, 1, 0, 0, 0)
    event = PoPUpgradeEvent(
        timestamp=timestamp,
        validator_id=validator,
        vaultloop_hash="hash-123",
        previous_tier=previous,
        new_tier=new,
    )
    return PoPScoreResult(
        validator_id=validator,
        score=float(new * 2 + 0.5),
        tier=new,
        timestamp=timestamp,
        vaultloop_hash="hash-123",
        upgrade_event=event,
    )


def test_routing_via_engine_listener(tmp_path):
    engine = PoPEngine(cache_path=tmp_path / "pop_cache.json")
    router = VaultdripRouter(codex_registry_path=tmp_path / "codex_log.jsonl")
    router.attach_to(engine)

    # seed a previous tier so the next score triggers an upgrade event
    engine._record_history(  # noqa: SLF001 - intentional seeding for test
        "validator-1",
        {
            "timestamp": datetime.utcnow().isoformat(),
            "score": 1.0,
            "tier": 0,
            "vaultloop_hash": "hash-seed",
        },
    )

    engine.calculate_score(
        "validator-1",
        recall_strength=1.0,
        amplifier_streak=5,
        vaultloop_hash="hash-evt",
    )

    routed = router.routed_events[-1]
    assert routed.status == "routed"
    assert routed.release["tier"] == routed.tier
    assert routed.metadata["belief_score"] >= 0


def test_tier_based_release_amounts():
    router = VaultdripRouter()
    tier_one = router.route_reward(_score_result("v1", 0, 1))
    tier_three = router.route_reward(_score_result("v1", 1, 3))

    assert tier_one.release["amount"] < tier_three.release["amount"]
    assert tier_three.metadata["validator_loyalty_index"] >= tier_one.metadata[
        "validator_loyalty_index"
    ]


def test_bonus_flagging():
    router = VaultdripRouter(loyalty_threshold=3)
    routed = router.route_reward(_score_result("loyal", 1, 3))

    assert routed.bonus_flagged is True
    assert "loyal" in router.flagged_validators


def test_spoofed_event_rejected():
    router = VaultdripRouter()
    timestamp = datetime.utcnow()
    event = PoPUpgradeEvent(
        timestamp=timestamp,
        validator_id="spoofed",
        vaultloop_hash="hash-bad",
        previous_tier=0,
        new_tier=2,
    )
    result = PoPScoreResult(
        validator_id="honest",
        score=5.5,
        tier=2,
        timestamp=timestamp,
        vaultloop_hash="hash-bad",
        upgrade_event=event,
    )

    routed = router.route_reward(result)

    assert routed.status == "rejected"
    assert routed.reason == "spoofed-event"
    assert routed.release is None
