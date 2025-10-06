import pytest

from vaultfire.token import FireTokenProtocol, prepare_fire_token_protocol


def test_prepare_fire_token_protocol_exports_manifest():
    protocol = prepare_fire_token_protocol(
        name="$FIRE",
        symbol="VFIRE",
        governance_control="Ghostkey DAO",
        unlock_conditions=["Proof-of-Yield", "Protocol Activation", "Quantum Layer Verified", "Proof-of-Yield"],
        supply_model="adaptive + yield-synced",
        reward_weighting={
            "Ghostkey-316": "Founding Multiplier x5",
            "Architects": "x2",
            "Early Believers": "x1.5",
        },
    )

    assert isinstance(protocol, FireTokenProtocol)
    exported = protocol.export()
    assert exported["name"] == "$FIRE"
    assert exported["symbol"] == "VFIRE"
    assert exported["governance_control"] == "Ghostkey DAO"
    assert exported["unlock_conditions"] == [
        "Proof-of-Yield",
        "Protocol Activation",
        "Quantum Layer Verified",
    ]
    assert exported["reward_weighting"]["Ghostkey-316"] == "Founding Multiplier x5"
    assert len(exported["checksum"]) == 64


def test_prepare_fire_token_protocol_validates_inputs():
    with pytest.raises(ValueError):
        prepare_fire_token_protocol(
            name="",
            symbol="VFIRE",
            governance_control="Ghostkey DAO",
            unlock_conditions=["Activation"],
            supply_model="adaptive",
            reward_weighting={"Group": "x1"},
        )

    with pytest.raises(ValueError):
        prepare_fire_token_protocol(
            name="$FIRE",
            symbol="VFIRE",
            governance_control="Ghostkey DAO",
            unlock_conditions=[],
            supply_model="adaptive",
            reward_weighting={"Group": "x1"},
        )

    with pytest.raises(ValueError):
        prepare_fire_token_protocol(
            name="$FIRE",
            symbol="VFIRE",
            governance_control="Ghostkey DAO",
            unlock_conditions=["Activation"],
            supply_model="adaptive",
            reward_weighting={},
        )
