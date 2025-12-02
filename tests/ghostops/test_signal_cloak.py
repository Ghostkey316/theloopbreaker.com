from ghostops_v1.signal_cloak import SignalCloakConfig, SignalCloakSystem


def test_passive_obfuscation_roundtrip():
    cloak = SignalCloakSystem(SignalCloakConfig(mode="passive", keyword_salt="vaultfire"))
    payload = cloak.obfuscate("ghostkey alignment signal")

    assert payload["mode"] == "passive"
    assert payload["scrambled"] != "ghostkey alignment signal"
    assert cloak.reveal(payload) == "ghostkey alignment signal"


def test_active_obfuscation_encodes_and_reveals():
    cloak = SignalCloakSystem(SignalCloakConfig(mode="active", keyword_salt="vaultfire"))
    payload = cloak.obfuscate("quantum ghostops ready")

    assert payload["mode"] == "active"
    assert "encoded" in payload and payload["encoded"] != "quantum ghostops ready"
    assert "fingerprint" in payload
    assert cloak.reveal(payload) == "quantum ghostops ready"
