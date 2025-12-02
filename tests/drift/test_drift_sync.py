from datetime import datetime, timedelta

from drift_sync import DriftSync


def test_drift_metrics_and_score():
    drift_sync = DriftSync(inactivity_threshold=timedelta(minutes=30))
    base = datetime(2024, 1, 1, 12, 0, 0)

    drift_sync.record_prompt("alice", belief=0.9, sentiment=0.2, timestamp=base)
    drift_sync.record_prompt(
        "alice", belief=0.92, sentiment=0.25, timestamp=base + timedelta(minutes=10)
    )
    drift_sync.record_prompt(
        "alice", belief=0.93, sentiment=0.3, timestamp=base + timedelta(hours=1)
    )

    metrics = drift_sync.get_metrics("alice")

    assert metrics.prompt_cadence == [600.0, 3000.0]
    assert metrics.inactivity_gaps == [3000.0]
    assert metrics.belief_streak == 1  # streak resets after inactivity gap
    assert 0.0 < metrics.emotional_consistency <= 1.0
    assert 0 < metrics.drift_score <= 316


def test_drift_score_updates_with_new_prompt():
    drift_sync = DriftSync(inactivity_threshold=timedelta(minutes=15))
    now = datetime(2024, 5, 1, 9, 0, 0)
    drift_sync.record_prompt("bob", belief=0.8, sentiment=0.4, timestamp=now)
    initial_score = drift_sync.drift_score("bob")

    drift_sync.record_prompt(
        "bob", belief=0.82, sentiment=0.45, timestamp=now + timedelta(minutes=5)
    )
    updated_score = drift_sync.drift_score("bob")

    assert updated_score >= initial_score
