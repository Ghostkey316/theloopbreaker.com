"""Tests for the UltraShadow module."""

from datetime import datetime, timedelta

from cloak_pulse import CloakPulse
from signal_scrambler import SignalScrambler
from utils.entropy_seed import EntropySeed

from vaultfire.modules.ultrashadow import UltraShadow


def _build_ultrashadow() -> UltraShadow:
    seed = EntropySeed(base_seed="ultra-shadow-test", debug=True)
    pulse = CloakPulse(seed, lineage="UltraShadowTest", debug=True)
    scrambler = SignalScrambler(cloak_pulse=pulse, wallet_origin="bpow20.cb.id", debug=True)
    return UltraShadow(cloak_pulse=pulse, signal_scrambler=scrambler, reroute_interval=5)


def test_smudge_and_reroute_cycle() -> None:
    ultrashadow = _build_ultrashadow()
    smudged = ultrashadow.smudge_memory_traces(["alpha", "beta"])
    assert len(smudged) == 2
    assert smudged[0]["trace"] == "alpha"

    now = datetime.utcnow()
    rerouted = ultrashadow.reroute_signals(["ghost::1"], timestamp=now, force=True)
    assert rerouted and rerouted[0]["route_hint"] == "ultrashadow"

    later = now + timedelta(seconds=10)
    rerouted_again = ultrashadow.reroute_signals(["ghost::1"], timestamp=later)
    assert rerouted_again != []


def test_fallback_updates_status() -> None:
    ultrashadow = _build_ultrashadow()
    fallback = ultrashadow.activate_fallback("unit-test")
    assert fallback["engaged"] is True
    status = ultrashadow.status()
    assert status["fallback"]["engaged"] is True
