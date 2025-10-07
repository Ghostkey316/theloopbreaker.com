from vaultfire.signal_compass import (
    CompassRing,
    HesitationLens,
    MoralVector,
    SignalPulse,
)


def test_compass_ring_goes_live():
    pulse = SignalPulse(identity="Ghostkey-316", input_feed="vaultfire.echain")
    vector = MoralVector(
        reference_framework="Ghostkey Ethics v2.0",
        priority=["truth", "service", "forgiveness"],
    )
    lens = HesitationLens(trigger_threshold=0.77, retro_echo_boost=True)

    ring = CompassRing(pulse, vector, lens)
    frame = ring.display(mode="overlay", sync="live")

    assert ring.status == "LIVE"
    assert frame["signal"]["identity"] == "Ghostkey-316"
    assert frame["mode"] == "overlay"
    assert frame["sync"] == "live"
    assert frame["hesitation"]["flagged"] is False
