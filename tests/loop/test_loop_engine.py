from datetime import timedelta

import pytest

from vaultfire.identity.layer import IdentityWeaveCore
from vaultfire.loop import (
    BeliefEchoAmplifier,
    LoopPulseTracker,
    PoPScoreModule,
    VaultfireDripRouter,
)
from vaultfire.memory.modules.memory_thread import MemoryThreadCore
from vaultfire.validation import ValidationReport


def _build_anchor_and_event(persona: str = "alice"):
    memory_core = MemoryThreadCore()
    event = memory_core.record_memory(
        persona,
        prompt="test loop",
        heart_rate=72,
        galvanic_skin_response=0.21,
        voice_tremor=0.08,
    )
    identity = IdentityWeaveCore()
    anchor = identity.bind_snapshot(persona, soulprint=event.soulprint)
    return anchor, event


def test_loop_activation_and_deactivation():
    anchor, event = _build_anchor_and_event()
    tracker = LoopPulseTracker(epoch_span=60, activation_threshold=0.8)

    snapshot = tracker.pulse(anchor.persona_tag, anchor=anchor, memory_event=event)
    assert snapshot.active

    inactive_snapshot = tracker.pulse(
        anchor.persona_tag,
        anchor=anchor,
        memory_event=event,
        zk_identity_hash="tamper",
        continuity_hash="mismatch",
    )
    assert not inactive_snapshot.active


def test_echo_detection_logic():
    amplifier = BeliefEchoAmplifier(sync_window=4, boost_per_sync=0.5)
    state = amplifier.apply("belief-A", ["belief-A", "belief-A", "belief-B"], validator_score=0.9)
    assert state.synchronized is True
    assert state.tier in {"sync", "resonant", "prime"}
    assert state.multiplier > 1.4


def test_multiplier_scaling_edge_cases():
    amplifier = BeliefEchoAmplifier(max_multiplier=2.2)
    state = amplifier.apply("dense", peers=["dense"] * 8, validator_score=5.0)
    assert state.multiplier <= 2.2


def test_zk_aligned_payout_safety(tmp_path):
    anchor, event = _build_anchor_and_event("zk-safe")
    tracker = LoopPulseTracker(epoch_span=30)
    snapshot = tracker.pulse(anchor.persona_tag, anchor=anchor, memory_event=event)

    amplifier = BeliefEchoAmplifier()
    amp_state = amplifier.apply(
        snapshot.report.belief_hash, [], validator_score=snapshot.report.validator_score
    )
    pop_module = PoPScoreModule()
    pop_score = pop_module.score(snapshot, amp_state, active_echo=amp_state.synchronized)

    router = VaultfireDripRouter(log_dir=tmp_path)
    schedule = router.schedule(snapshot, amp_state, pop_score)
    assert schedule.projected_yield_rate > 0

    unsafe_report = ValidationReport(
        persona_tag=anchor.persona_tag,
        zk_consistent=False,
        soulprint_match=False,
        continuity_verified=False,
        belief_hash="",
        drift_detected=True,
        ethics_alignment=0.1,
        ethics_state="violation",
        validator_score=0.0,
        continuity_hash="",
    )
    unsafe_snapshot = snapshot.__class__(
        persona_tag=anchor.persona_tag,
        timestamp=snapshot.timestamp,
        report=unsafe_report,
        memory_event=snapshot.memory_event,
        next_drip_epoch=snapshot.next_drip_epoch,
        active=False,
    )
    capped_schedule = router.schedule(unsafe_snapshot, amp_state, pop_score)
    assert capped_schedule.projected_yield_rate == 0
    assert list(tmp_path.glob("*.loopdrop"))
