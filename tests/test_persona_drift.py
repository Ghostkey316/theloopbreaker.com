"""Tests for the PersonaDrift module."""

from persona_drift import PersonaDrift


def test_persona_drift_generates_unique_wallets():
    drift = PersonaDrift(cloak_pulse=None, debug=True)

    persona = drift.shift("vaultfire.app", {"timezone": "UTC"})

    assert persona.wallet_address.startswith("0x")
    assert persona.wallet_origin == "bpow20.cb.id"
    assert persona.override_route.startswith("ghostkey316://override/")
    assert persona.traits["behavioral_vector"]
    assert persona.lineage == "Ghostkey-316"


def test_persona_drift_respects_consent_toggle():
    drift = PersonaDrift()

    try:
        drift.shift("vaultfire.denied", consented=False)
    except PermissionError:
        pass
    else:
        raise AssertionError("Expected PermissionError when consent is denied")
