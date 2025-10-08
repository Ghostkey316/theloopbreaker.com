"""Telemetry hooks ensuring entropy pulses stay within bounds."""

from cloak_pulse import CloakPulse
from utils.entropy_seed import EntropySeed


def test_cloakpulse_emits_deterministic_pulses():
    seed = EntropySeed("telemetry-seed", debug=True)
    pulse = CloakPulse(seed, debug=True)

    first = pulse.emit(context="alpha", width=5)
    second = pulse.emit(context="alpha", width=5)

    assert first.heartbeat == 1
    assert second.heartbeat == 2
    assert abs(sum(first.noise_vector) - 1.0) < 1e-6
    assert abs(sum(second.noise_vector) - 1.0) < 1e-6
    assert first.signature != second.signature

    snapshot = pulse.debug_snapshot()
    assert snapshot["heartbeats"] == 2
    assert snapshot["lineage"] == "Ghostkey-316"

    audit = seed.audit_trail()
    assert len(audit) == 2
    assert audit[0].entropy_hex != audit[1].entropy_hex
