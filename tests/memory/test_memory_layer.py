"""Tests for Vaultfire Memory Layer v1.0."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from vaultfire.memory import EmotionTraceRouter, MemoryThreadCore, MindTraceCLI, RecallLoopModule, TimePulseSync


def fixed_time():
    return datetime(2024, 1, 1, 12, 0, 0)


def test_time_pulse_sync_blocks():
    sync = TimePulseSync(block_span=60, time_source=fixed_time)
    anchor = sync.anchor(emotional_intensity=0.5)
    assert anchor.block_start == datetime(2024, 1, 1, 12, 0, 0)
    assert anchor.block_end == datetime(2024, 1, 1, 12, 1, 0)
    assert anchor.ordinal == int(anchor.block_start.timestamp()) // 60
    assert anchor.emotional_timestamp == anchor.ordinal + 0.5


def test_memory_thread_hashing_changes_with_delta():
    memory_core = MemoryThreadCore(time_pulse=TimePulseSync(block_span=300, time_source=fixed_time))
    event = memory_core.record_memory(
        "user-1",
        prompt="first",
        heart_rate=72,
        galvanic_skin_response=0.5,
        voice_tremor=0.1,
        emotional_delta={"calm": 0.2},
        timestamp=fixed_time(),
    )
    event_variant = memory_core.record_memory(
        "user-1",
        prompt="first",
        heart_rate=72,
        galvanic_skin_response=0.5,
        voice_tremor=0.1,
        emotional_delta={"calm": 0.25},
        timestamp=fixed_time() + timedelta(seconds=10),
    )
    assert event.memory_hash != event_variant.memory_hash
    assert event.soulprint.hash != event_variant.soulprint.hash
    assert memory_core.thread("user-1")[-1].anchor.ordinal == event.anchor.ordinal


def test_recall_loop_fallback_trace_resolution():
    recall_loop = RecallLoopModule(memory_core=MemoryThreadCore())
    context = recall_loop.regenerate_context(
        "new-user",
        belief_weight=0.8,
        tone_resonance=0.4,
        biometric_cadence=0.6,
    )
    assert context.fallback_used is True
    assert context.continuity_profile.get("fallback_trace") == 1.0


def test_integration_with_soul_sensation_and_drift():
    memory_core = MemoryThreadCore(time_pulse=TimePulseSync(block_span=120, time_source=fixed_time))
    event = memory_core.record_memory(
        "bridge-user",
        prompt="bridge",
        heart_rate=80,
        galvanic_skin_response=0.4,
        voice_tremor=0.15,
        emotional_delta={"focus": 0.3},
        timestamp=fixed_time(),
    )
    router = EmotionTraceRouter(memory_core=memory_core)
    linked = router.link_states("bridge-user", prompt="follow-up", emotional_tone=0.42)
    assert linked["hint"] == "continuity"
    assert linked["continuity_profile"]["linked_prompts"] == ["bridge"]
    assert event.drift_score >= 0


def test_mind_trace_cli_snapshot_recall():
    memory_core = MemoryThreadCore(time_pulse=TimePulseSync(block_span=90, time_source=fixed_time))
    memory_core.record_memory(
        "cli-user",
        prompt="export",
        heart_rate=76,
        galvanic_skin_response=0.55,
        voice_tremor=0.08,
        emotional_delta={"steady": 0.12},
        timestamp=fixed_time(),
    )
    cli = MindTraceCLI(memory_core=memory_core)
    bundle = cli.export_bundle("cli-user", ghostseal_obfuscate=True)
    assert bundle["cid"].startswith("bafy")
    snapshot = cli.snapshot_recall_test(bundle["sealed"])
    assert snapshot["cid_match"] is True
    assert "events" in snapshot["payload"]
