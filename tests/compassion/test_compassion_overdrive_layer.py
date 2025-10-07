from vaultfire.consciousness import CompassionOverdriveLayer


def test_compassion_overdrive_boost_amplifies_level():
    layer = CompassionOverdriveLayer(base_level=0.55)
    event = layer.boost(
        context="distress-signal",
        severity=0.8,
        empathy_tags=("support", "aid"),
        consent_granted=True,
    )

    assert event["amplified"] is True
    assert event["level"] >= 0.55

    current = layer.decay(ratio=0.1)
    assert current <= event["level"]
    assert layer.status()["current_level"] == current
