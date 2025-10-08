"""Tests for the SignalScrambler engine."""

from datetime import datetime

from cloak_pulse import CloakPulse
from mirrorlock_core import MirrorlockCore
from signal_scrambler import SignalScrambler
from utils.entropy_seed import EntropySeed


def test_signal_scrambler_injects_noise():
    seed = EntropySeed("vaultfire-seed", debug=True)
    cloak_pulse = CloakPulse(seed, debug=True)
    scrambler = SignalScrambler(cloak_pulse=cloak_pulse, debug=True)
    core = MirrorlockCore()

    token = core.observe("vaultfire.signal", "dispatch", metadata={"amount": 3})
    results = scrambler.scramble([token], route_hint="vaultfire.signal")

    assert len(results) == 1
    scrambled = results[0]
    assert scrambled.original_fingerprint != scrambled.noise_fingerprint
    assert scrambled.deviation_score >= scrambler.noise_floor
    assert scrambled.wallet_origin == "bpow20.cb.id"
    assert scrambled.timestamp <= datetime.utcnow()

    audit = scrambler.audit_trail()
    assert audit[0].debug_meta["heartbeat"] >= 1
    assert audit[0].debug_meta["noise_vector"]


def test_signal_scrambler_handles_strings():
    seed = EntropySeed("another-seed")
    cloak_pulse = CloakPulse(seed)
    scrambler = SignalScrambler(cloak_pulse=cloak_pulse)

    result = scrambler.scramble(["manual-fingerprint"], route_hint="manual")

    assert result[0].token_id.startswith("scramble::")
    assert result[0].noise_fingerprint
