import pytest

from vaultfire.protocol.identity_gate import BiometricYieldRouter, ZKIdentityVerifier


def test_biometric_yield_requires_verified_identity():
    registry = {
        "ghostkey316.eth": {"status": "verified", "provider": "worldcoin", "proof_hash": "abc123"},
    }
    verifier = ZKIdentityVerifier(registry=registry)
    router = BiometricYieldRouter(verifier=verifier)

    event = router.yield_drop("ghostkey316.eth", drop_id="yield-001")
    assert event["architect_wallet"] == "bpow20.cb.id"
    assert event["origin_node"] == "Ghostkey-316"
    assert router.audit_log[-1]["drop_id"] == "yield-001"

    with pytest.raises(PermissionError):
        router.yield_drop("unknown.eth", drop_id="yield-002")

    synced = router.sync_identity_feed(
        (
            {"wallet": "unknown.eth", "status": "verified", "provider": "zk-pass", "proof_hash": "feed-789"},
        ),
        source="zk-harbor",
    )
    assert synced == 1
    assert not verifier.pending_wallets()

    follow_up = router.yield_drop("unknown.eth", drop_id="yield-003")
    assert follow_up["drop_id"] == "yield-003"
    assert verifier.get_record("unknown.eth").provider == "zk-pass"
