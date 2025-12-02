import base64
import json
from datetime import datetime

from vaultfire.identity.layer import IdentityWeaveCore
from vaultfire.loop import BeliefEchoAmplifier, LoopPulseTracker, PoPScoreModule, VaultfireDripRouter
from vaultfire.memory import LoopMemoryCLI, MemoryThreadCore, TimePulseSync, VaultMemorySync


def fixed_time() -> datetime:
    return datetime(2024, 1, 1, 0, 0, 0)


def _anchor_and_event(persona: str = "sync-user"):
    memory_core = MemoryThreadCore(time_pulse=TimePulseSync(block_span=60, time_source=fixed_time))
    event = memory_core.record_memory(
        persona,
        prompt="loop sync",
        heart_rate=72,
        galvanic_skin_response=0.25,
        voice_tremor=0.07,
        timestamp=fixed_time(),
    )
    anchor = IdentityWeaveCore().bind_snapshot(persona, soulprint=event.soulprint)
    return anchor, event


def test_vault_memory_sync_cycle_and_recall(tmp_path):
    anchor, event = _anchor_and_event()
    memory_sync = VaultMemorySync(snapshot_dir=tmp_path / "loop_sync")
    tracker = LoopPulseTracker(
        epoch_span=60,
        activation_threshold=0.25,
        time_source=fixed_time,
        memory_sync=memory_sync,
    )
    snapshot = tracker.pulse(anchor.persona_tag, anchor=anchor, memory_event=event)

    amplifier = BeliefEchoAmplifier(sync_window=3, boost_per_sync=0.4)
    amp_state = amplifier.apply(snapshot.report.belief_hash, peers=[snapshot.report.belief_hash], validator_score=snapshot.report.validator_score)
    pop_module = PoPScoreModule()
    pop_score = pop_module.score(snapshot, amp_state, active_echo=amp_state.synchronized)

    router = VaultfireDripRouter(log_dir=tmp_path / "logs", memory_sync=memory_sync)
    schedule = router.schedule(snapshot, amp_state, pop_score)

    snapshot_files = list((tmp_path / "loop_sync" / event.soulprint.hash).glob("*.json"))
    assert snapshot_files, "loop sync snapshot was not written"
    data = json.loads(snapshot_files[0].read_text())

    assert data["loopdrop"]["format"] == ".loopdrop"
    assert data["vaultproof"]["format"] == ".vaultproof"
    assert data["vaultloop"]["drip_yield"] == schedule.projected_yield_rate
    assert data["vaultloop"]["soulprint"] == event.soulprint.hash
    assert data["vaultloop"]["echo_history"]

    cli = LoopMemoryCLI(memory_sync=memory_sync)
    recalled = cli.recall(event.soulprint.hash, pop_tier=amp_state.tier)
    assert len(recalled) == 1
    empty = cli.recall(event.soulprint.hash, pop_tier="prime" if amp_state.tier != "prime" else "idle")
    assert not empty
    validator_filtered = cli.recall(event.soulprint.hash, validator_id=data["validator_id"])
    assert validator_filtered

    decoded = json.loads(base64.b64decode(data["vaultproof"]["encoded"]).decode())
    assert decoded == data["vaultproof"]["payload"]
