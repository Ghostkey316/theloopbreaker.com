import pytest

from vaultfire.protocol.secure_collaboration import MPCFabric
from vaultfire.security.fhe import FHECipherSuite, Ciphertext
from vaultfire.protocol.telemetry import ZKFog


def test_mpc_collaboration_generates_proof():
    suite = FHECipherSuite()
    fabric = MPCFabric(cipher_suite=suite)
    fabric.submit_encrypted_payload("alpha.eth", {"stake": 10}, signal_context="shared-staking")
    fabric.submit_encrypted_payload("beta.eth", {"stake": 12}, signal_context="shared-staking")

    result = fabric.collaborative_sum()
    assert isinstance(result["ciphertext"], Ciphertext)
    assert result["participants"] == 2
    assert result["proof"]["context"] == "vaultfire::mpc_collaboration"
    assert result["architect_wallet"] == "bpow20.cb.id"
    assert result["origin_node"] == "Ghostkey-316"
    assert result["blueprint_ids"] == []

    summary = fabric.decrypt_summary()
    assert summary["participants"] == 2
    assert summary["moral_tag"] == suite.moral_tag
    assert summary["compliance_scopes"] == []


def test_mpc_auto_blueprint_enforces_required_fields():
    suite = FHECipherSuite()
    fabric = MPCFabric(cipher_suite=suite)

    blueprint = fabric.autoconfigure(
        "mega-partner",
        required_fields=("stake", "region"),
        compliance_tags={"region": "eu", "tier": "regulated"},
    )

    assert blueprint["partner_id"] == "mega-partner"
    assert blueprint["required_fields"] == ("region", "stake")

    with pytest.raises(ValueError):
        fabric.submit_encrypted_payload(
            "gamma.eth",
            {"stake": 5},
            signal_context="regulated",
            partner_id="mega-partner",
        )

    fabric.submit_encrypted_payload(
        "gamma.eth",
        {"stake": 5, "region": "eu"},
        signal_context="regulated",
        partner_id="mega-partner",
    )

    result = fabric.collaborative_sum()
    assert result["blueprint_ids"]
    assert blueprint["blueprint_hash"] in result["blueprint_ids"]

    summary = fabric.decrypt_summary()
    assert summary["compliance_scopes"]
    assert summary["compliance_scopes"][0]["region"] == "eu"


def test_zk_fog_emits_encrypted_summary():
    entries = (
        {"ethics": "aligned", "action": "stake"},
        {"ethics": "aligned", "action": "vote"},
    )
    fog = ZKFog(behavior_input=entries, output_proof="ethics_compliant_weekly_summary")
    proof = fog.synthesize_summary()
    assert proof["events"] == 2
    assert proof["proof"]["context"] == "telemetry::ethics_compliant_weekly_summary"
    assert proof["architect_wallet"] == "bpow20.cb.id"
