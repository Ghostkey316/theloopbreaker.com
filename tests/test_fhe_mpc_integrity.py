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

    summary = fabric.decrypt_summary()
    assert summary["participants"] == 2
    assert summary["moral_tag"] == suite.moral_tag


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
