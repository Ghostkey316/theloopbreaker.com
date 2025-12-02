"""Tests for Vaultfire Validation Layer v1.0."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from vaultfire.identity.layer import IdentityWeaveCore
from vaultfire.memory import MemoryThreadCore, TimePulseSync
from vaultfire.validation import (
    BeliefProofEngine,
    EpochLockTracer,
    ValidationTraceCLI,
    ValidatorCore,
    ValidatorExportRouter,
)


def fixed_time() -> datetime:
    return datetime(2024, 1, 1, 12, 0, 0)


def build_memory_event():
    memory_core = MemoryThreadCore(time_pulse=TimePulseSync(block_span=180, time_source=fixed_time))
    event = memory_core.record_memory(
        "validator-user",
        prompt="prime",
        heart_rate=72,
        galvanic_skin_response=0.52,
        voice_tremor=0.08,
        emotional_delta={"steady": 0.15},
        timestamp=fixed_time(),
    )
    return memory_core, event


def bind_anchor(event):
    identity_core = IdentityWeaveCore()
    anchor = identity_core.bind_snapshot(
        "validator-user",
        soulprint=event.soulprint,
        identifiers={"social": ["@vaultfire"]},
    )
    return identity_core, anchor


def test_soulprint_and_memory_hash_matching():
    memory_core, event = build_memory_event()
    identity_core, anchor = bind_anchor(event)
    validator = ValidatorCore(identity_core=identity_core, memory_core=memory_core)

    report = validator.validate("validator-user", anchor=anchor, memory_event=event)

    assert report.soulprint_match is True
    assert report.zk_consistent is True
    assert report.continuity_verified is True
    assert report.validator_score == 1.0


def test_belief_drift_edge_cases():
    memory_core, event = build_memory_event()
    _, anchor = bind_anchor(event)
    belief_engine = BeliefProofEngine()

    baseline = belief_engine.compare(anchor, event)
    drift_event = memory_core.record_memory(
        "validator-user",
        prompt="follow-up",
        heart_rate=86,
        galvanic_skin_response=0.65,
        voice_tremor=0.25,
        emotional_delta={"agitation": 0.44},
        timestamp=fixed_time() + timedelta(seconds=60),
    )
    drift = belief_engine.compare(
        anchor,
        drift_event,
        previous_hash=baseline["belief_hash"],
        ethics_vector={"ethics": 0.7},
    )

    assert drift["drift_detected"] is True
    assert drift["belief_hash"] != baseline["belief_hash"]


def test_cli_trace_accuracy():
    memory_core, event = build_memory_event()
    identity_core, anchor = bind_anchor(event)
    tracer = EpochLockTracer(decay_window=300)
    validator = ValidatorCore(identity_core=identity_core, memory_core=memory_core, tracer=tracer)
    cli = ValidationTraceCLI(validator=validator)

    output = cli.trace("validator-user", anchor=anchor, memory_event=event)
    assert "validator_score" in output
    assert tracer.history[-1]["state"]["zk"] is True


def test_ethics_integrity_violations():
    memory_core, event = build_memory_event()
    identity_core, anchor = bind_anchor(event)
    validator = ValidatorCore(identity_core=identity_core, memory_core=memory_core)

    report = validator.validate(
        "validator-user",
        anchor=anchor,
        memory_event=event,
        ethics_vector={"harm": 0.2, "consent": 0.3},
    )

    assert report.ethics_state == "violation"
    assert report.validator_score < 1


def test_zk_mismatch_and_recovery():
    memory_core, event = build_memory_event()
    identity_core, anchor = bind_anchor(event)
    validator = ValidatorCore(identity_core=identity_core, memory_core=memory_core)
    router = ValidatorExportRouter(tracer=EpochLockTracer(decay_window=90))

    report = validator.validate(
        "validator-user",
        anchor=anchor,
        memory_event=event,
        zk_identity_hash="invalid-zk",
    )
    recovered = validator.recover_zk(anchor, event)
    vaultproof = router.export_vaultproof(report)
    zk_log = router.export_zk_log([report])

    assert report.zk_consistent is False
    assert recovered != "invalid-zk"
    assert vaultproof["format"] == ".vaultproof"
    assert zk_log["entries"][0]["continuity"] == report.continuity_hash
