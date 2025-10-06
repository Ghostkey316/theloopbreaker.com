"""Tests for the Vaultfire optimization helpers."""

import pytest

from vaultfire import optimization
from vaultfire.optimization import (
    enable_coin_cross_compatibility,
    enhance_protocol_speed,
    get_optimization_state,
    improve_logic_routing,
    increase_yield_capture,
    reset_optimization_state,
    upgrade_error_resilience,
)


@pytest.fixture(autouse=True)
def _reset_state():
    """Ensure every test starts from the default optimization state."""

    reset_optimization_state()
    yield
    reset_optimization_state()


def test_reset_restores_defaults():
    enhance_protocol_speed(level="max")
    improve_logic_routing(depth="deep")
    reset_optimization_state()

    state = get_optimization_state()
    assert state.protocol_speed == "balanced"
    assert state.logic_depth == "standard"
    assert state.cross_compatible is False
    assert state.supported_coins == ()
    assert state.yield_multiplier == pytest.approx(1.0)
    assert state.error_resilience == "baseline"


def test_enhance_protocol_speed_updates_state():
    state = enhance_protocol_speed(level="high")
    assert state.protocol_speed == "high"
    assert get_optimization_state().protocol_speed == "high"


def test_enhance_protocol_speed_rejects_unknown_level():
    with pytest.raises(ValueError):
        enhance_protocol_speed(level="warp")


def test_improve_logic_routing_rejects_unknown_depth():
    with pytest.raises(ValueError):
        improve_logic_routing(depth="infinite")


def test_enable_coin_cross_compatibility_requires_coins_when_not_all():
    with pytest.raises(ValueError):
        enable_coin_cross_compatibility()


def test_enable_coin_cross_compatibility_sets_sorted_uppercase_coins():
    state = enable_coin_cross_compatibility(coins=["eth", "btc", " eth "])
    assert state.cross_compatible is True
    assert state.supported_coins == ("BTC", "ETH")


def test_enable_coin_cross_compatibility_include_all():
    state = enable_coin_cross_compatibility(include_all=True)
    assert state.supported_coins == ("*",)


def test_increase_yield_capture_requires_positive_multiplier():
    with pytest.raises(ValueError):
        increase_yield_capture(multiplier=0)


def test_increase_yield_capture_updates_state():
    state = increase_yield_capture(multiplier=2.5)
    assert state.yield_multiplier == pytest.approx(2.5)


def test_upgrade_error_resilience_accepts_known_method():
    state = upgrade_error_resilience(method="auto-recovery")
    assert state.error_resilience == "auto-recovery"


def test_upgrade_error_resilience_rejects_unknown_method():
    with pytest.raises(ValueError):
        upgrade_error_resilience(method="quantum")


def test_module_is_available_via_package_namespace():
    # Accessing the module via the package ensures lazy loading is configured.
    assert hasattr(optimization, "enhance_protocol_speed")
