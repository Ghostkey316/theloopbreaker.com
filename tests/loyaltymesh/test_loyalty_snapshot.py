from datetime import datetime
from pathlib import Path

from vaultfire.loyalty_engine import LoyaltyEngine
from vaultfire.loyalty_snapshot import LoyaltySnapshotter


def test_capture_snapshot_and_history(tmp_path: Path):
    clock = lambda: datetime(2024, 6, 1)
    engine = LoyaltyEngine(clock=clock)
    snapshot_path = tmp_path / "snapshots.json"
    snapshotter = LoyaltySnapshotter(engine, snapshot_path=snapshot_path)

    snapshot = snapshotter.capture(
        "validator-3",
        pop_tier=3,
        belief_sync_streak=7,
        recall_history=[1, 0.9, 0.8],
        missed_windows=1,
    )

    assert snapshot.validator_id == "validator-3"
    assert snapshot.net_multiplier > 1.0
    assert snapshot.active_streak_days == 7
    assert snapshot.missed_windows == 1
    assert snapshot.yield_class in {"Gold", "Sovereign", "Silver", "Bronze"}

    history = snapshotter.history()
    assert len(history) == 1
    assert history[0]["validator_id"] == "validator-3"


def test_projection_counts_by_yield_class(tmp_path: Path):
    engine = LoyaltyEngine(clock=lambda: datetime(2024, 6, 1))
    snapshotter = LoyaltySnapshotter(engine, snapshot_path=tmp_path / "snapshots.json")

    validators = [
        {"validator_id": "alpha", "pop_tier": 3, "belief_sync_streak": 10, "recall_precision": 0.95},
        {"validator_id": "beta", "pop_tier": 1, "belief_sync_streak": 2, "recall_precision": 0.8},
        {"validator_id": "gamma", "pop_tier": 2, "belief_sync_streak": 0, "recall_precision": 0.6},
    ]

    projection = snapshotter.project_yield_classes(validators)

    total = sum(projection.values())
    assert total == len(validators)
    assert set(projection.keys()) <= {"Bronze", "Silver", "Gold", "Sovereign"}
