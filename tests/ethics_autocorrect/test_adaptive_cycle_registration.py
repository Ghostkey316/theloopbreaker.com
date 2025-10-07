from vaultfire.modules.vaultfire_protocol_stack import VaultfireProtocolStack


def test_register_adaptive_cycle_normalises_payload():
    payload = VaultfireProtocolStack.register_adaptive_cycle(
        {
            "calibration_interval": "dynamic",
            "reinforcement_model": "belief-integrity-recall",
            "error_tolerance": "morality-first",
            "auto_correct_bias": 1,
        }
    )

    assert payload["auto_correct_bias"] is True
    assert payload["calibration_interval"] == "dynamic"
    assert VaultfireProtocolStack.adaptive_cycle() == payload

    stack = VaultfireProtocolStack(actions=())
    assert stack.adaptive_cycle_manifest == payload
