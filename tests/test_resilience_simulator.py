from __future__ import annotations

import math

from vaultfire.security import (
    PilotConfig,
    ResilienceScenario,
    ResilienceSimulator,
)


def test_resilience_simulator_generates_metrics_and_failures():
    scenario = ResilienceScenario(
        wallet_count=2_000,
        loyalty_event_rate=0.2,
        staking_batch_size=250,
        pilot_iterations=2,
        replay_window=5_000,
        seed=1337,
    )
    simulator = ResilienceSimulator(scenario)

    def handler(event):
        # Introduce recoverable errors for a subset of events to verify failure handling.
        if math.isclose(event.loyalty_delta, 0.0, abs_tol=1e-9):
            return
        if event.loyalty_delta < -4:
            raise RuntimeError("loyalty regression")

    pilot = PilotConfig(name="alpha", handler=handler)
    results = simulator.run([pilot], concurrency=1)
    assert "alpha" in results
    result = results["alpha"]

    assert result.events  # ensures replay data is stored
    assert result.metrics["events_processed"] >= 1
    assert result.metrics["unique_wallets"] <= scenario.wallet_count
    assert result.metrics["failures"] == len(result.failures)

    # Replay with a no-op handler to verify deterministic behavior with seeded scenario.
    replay_result = simulator.replay("alpha", handler=lambda event: None)
    assert replay_result.metrics["replay_duration_seconds"] >= 0
    assert replay_result.metrics["events_processed"] == result.metrics["events_processed"]
    assert replay_result.metrics["failures"] == result.metrics["failures"]


def test_resilience_simulator_replay_uses_original_handler():
    scenario = ResilienceScenario(
        wallet_count=1_000,
        loyalty_event_rate=0.1,
        staking_batch_size=200,
        pilot_iterations=1,
        replay_window=2_000,
        seed=99,
    )
    simulator = ResilienceSimulator(scenario)

    processed = []

    def handler(event):
        processed.append(event.wallet_id)

    pilot = PilotConfig(name="beta", handler=handler)
    simulator.run([pilot], concurrency=1)
    processed.clear()

    replay_result = simulator.replay("beta")
    assert processed  # original handler invoked during replay
    assert len(processed) == len(replay_result.events)
    summary = replay_result.performance_summary()
    assert "duration_seconds" in summary
    assert "throughput_events_per_second" in summary
