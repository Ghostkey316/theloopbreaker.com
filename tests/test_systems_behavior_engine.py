from __future__ import annotations

from types import MappingProxyType

import pytest

from vaultfire.systems import (
    BehaviorEngineState,
    get_behavior_engine_state,
    optimize_behavior_engine,
    reset_behavior_engine_state,
)


@pytest.fixture(autouse=True)
def reset_state() -> None:
    reset_behavior_engine_state()
    yield
    reset_behavior_engine_state()


def test_optimize_behavior_engine_updates_state() -> None:
    state = optimize_behavior_engine(
        user_id="Ghostkey-316",
        wallet="bpow20.cb.id",
        enable_autotune=True,
        sync_learning_rate=1.25,
        memory_retention="permanent",
        feedback_loop="interactive",
        ethics_core="Ghostkey Ethics Framework v2.0",
    )

    assert isinstance(state, BehaviorEngineState)
    assert state.user_id == "Ghostkey-316"
    assert state.wallet == "bpow20.cb.id"
    assert state.autotune_enabled is True
    assert state.sync_learning_rate == pytest.approx(1.25)
    assert state.memory_retention == "permanent"
    assert state.feedback_loop == "interactive"
    assert state.ethics_core == "Ghostkey Ethics Framework v2.0"
    assert isinstance(state.metadata, MappingProxyType)
    assert state.metadata["autotune"] == "enabled"
    assert "sync_profile" in state.metadata

    retrieved = get_behavior_engine_state()
    assert retrieved == state


def test_reset_behavior_engine_state_restores_defaults() -> None:
    optimize_behavior_engine(
        user_id="Ghostkey-316",
        wallet="bpow20.cb.id",
        enable_autotune=False,
        sync_learning_rate=0.75,
        memory_retention="session",
        feedback_loop="passive",
        ethics_core="Ghostkey Ethics Framework v2.0",
    )

    reset_behavior_engine_state()
    state = get_behavior_engine_state()
    assert state.user_id == "anonymous"
    assert state.wallet == ""
    assert state.autotune_enabled is False
    assert state.memory_retention == "standard"
    assert state.feedback_loop == "passive"
    assert state.metadata["autotune"] == "disabled"


@pytest.mark.parametrize(
    "memory_policy",
    ["forever", "", "  "],
)
def test_invalid_memory_retention_rejected(memory_policy: str) -> None:
    with pytest.raises(ValueError):
        optimize_behavior_engine(
            user_id="Ghostkey-316",
            wallet="bpow20.cb.id",
            enable_autotune=True,
            sync_learning_rate=1.0,
            memory_retention=memory_policy,
            feedback_loop="interactive",
            ethics_core="Ghostkey Ethics Framework v2.0",
        )


def test_invalid_feedback_loop_rejected() -> None:
    with pytest.raises(ValueError):
        optimize_behavior_engine(
            user_id="Ghostkey-316",
            wallet="bpow20.cb.id",
            enable_autotune=True,
            sync_learning_rate=1.0,
            memory_retention="standard",
            feedback_loop="rapid",
            ethics_core="Ghostkey Ethics Framework v2.0",
        )


def test_enable_autotune_requires_boolean() -> None:
    with pytest.raises(TypeError):
        optimize_behavior_engine(
            user_id="Ghostkey-316",
            wallet="bpow20.cb.id",
            enable_autotune="yes",  # type: ignore[arg-type]
            sync_learning_rate=1.0,
            memory_retention="standard",
            feedback_loop="interactive",
            ethics_core="Ghostkey Ethics Framework v2.0",
        )

