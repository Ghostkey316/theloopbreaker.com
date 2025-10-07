from __future__ import annotations

from datetime import datetime, timedelta, timezone

from vaultfire.mission import MissionLedger
from vaultfire.protocol.ghostkey_ai import GhostkeyAINetwork
from vaultfire.quantum.hashmirror import QuantumHashMirror
from vaultfire.retroyield import BehaviorVault, LoopScanner, TokenDropper, YieldAnchor
from vaultfire.yield_config import RetroYieldConfig


def test_retroyield_end_to_end(tmp_path) -> None:
    retro_ledger = MissionLedger(path=tmp_path / "retro-ledger.jsonl", component="retro-test")
    ghost_ledger = MissionLedger(path=tmp_path / "ghost-ledger.jsonl", component="ghost-test")
    config = RetroYieldConfig(base_reward=10.0)

    ghost_network = GhostkeyAINetwork(ledger=ghost_ledger)
    ghost_network.deploy(wallet="0xabc", function="guardian")

    behavior = BehaviorVault(config=config, ledger=retro_ledger, ghostkey_network=ghost_network)
    hash_mirror = QuantumHashMirror(seed="retro-test")
    anchor = YieldAnchor(
        behavior_vault=behavior,
        config=config,
        ledger=retro_ledger,
        hash_mirror=hash_mirror,
    )

    base_time = datetime(2025, 2, 1, 12, 0, tzinfo=timezone.utc)
    anchor.record_action("0xabc", "belief:ignite", tags=["belief"], timestamp=base_time)
    anchor.record_action(
        "0xabc",
        "belief:sustain",
        tags=["belief"],
        timestamp=base_time + timedelta(hours=24),
    )
    anchor.record_action(
        "0xabc",
        "belief:share",
        tags=["belief"],
        timestamp=base_time + timedelta(hours=48),
    )

    snapshot = behavior.snapshot("0xabc")
    assert snapshot.loyalty_streak == 3
    assert snapshot.ghostkey_confirmed is True
    assert snapshot.behavior_multiplier > 1.0

    rehydrated_behavior = BehaviorVault(config=config, ledger=retro_ledger, ghostkey_network=ghost_network)
    rehydrated_snapshot = rehydrated_behavior.snapshot("0xabc")
    assert rehydrated_snapshot.loyalty_streak == snapshot.loyalty_streak

    scanner = LoopScanner(
        behavior_vault=behavior,
        config=config,
        ledger=retro_ledger,
        hash_mirror=hash_mirror,
    )
    rewards = scanner.scan(wallet="0xabc")
    assert len(rewards) == 1
    reward = rewards[0]
    assert reward.amount > 0
    assert len(reward.actions) == 3
    assert reward.ghostkey_confirmed is True

    dropper = TokenDropper(config=config, ledger=retro_ledger, hash_mirror=hash_mirror)
    scheduled = dropper.queue_rewards(rewards, unlock_after=timedelta(minutes=5), test_mode=True)
    assert len(scheduled) == 1

    simulation = dropper.simulate_unlock(scheduled[0].stream_id)
    assert simulation.test_mode is True
    assert simulation.amount == reward.amount

    live_drop = dropper.schedule(
        "0xabc",
        reward.amount,
        unlock_at=base_time + timedelta(minutes=1),
        epoch_index=reward.epoch_index,
        actions=reward.actions,
        multiplier=reward.multiplier,
    )
    dropper.override(live_drop.stream_id, unlock_at=base_time + timedelta(minutes=2))
    dropper.pause(live_drop.stream_id, reason="review")
    dropper.resume(live_drop.stream_id)

    results = dropper.process_due(now=base_time + timedelta(minutes=3))
    assert any(result.stream_id == live_drop.stream_id for result in results)
    live_result = next(result for result in results if result.stream_id == live_drop.stream_id)
    assert live_result.ledger_reference is not None
    assert live_result.test_mode is False

    pending_ids = {entry.stream_id for entry in dropper.pending}
    assert scheduled[0].stream_id in pending_ids
