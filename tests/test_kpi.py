from __future__ import annotations

from belief_tracker import BeliefTracker
from manifestFailover import create_failover


def test_belief_tracker_exports_prometheus_lines() -> None:
    tracker = BeliefTracker()
    tracker.ingest("alice.eth", tvl=500_000, drift=0.02, belief=0.97)
    tracker.ingest("bob.eth", tvl=300_000, drift=0.01, belief=0.95)
    metrics = list(tracker.export())
    assert any(m.name == "vaultfire_tvl_usd" for m in metrics)
    lines = [m.as_prometheus() for m in metrics]
    assert any("vaultfire_alignment_drift" in line for line in lines)
    assert "ATTESTATION" in tracker.attestation()


def test_manifest_failover_triggers_veto() -> None:
    guard = create_failover(threshold=0.1)
    result_clear = guard.evaluate_signal(adversarial=0.05, drift=0.02)
    assert result_clear["status"] == "clear"
    result_block = guard.evaluate_signal(adversarial=0.2, drift=0.06)
    assert result_block["status"] == "paused"
    assert guard.veto_log["last_veto"]["adversarial_percentage"] >= 0.2
