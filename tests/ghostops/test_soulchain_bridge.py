from pathlib import Path

from ghostops_v1.soulchain_bridge import SoulchainLoyaltyBridge


def test_commitments_encrypted_and_revealed(tmp_path: Path):
    commitments = tmp_path / "soul_commitments.json"
    bridge = SoulchainLoyaltyBridge(commitments_path=commitments, reveal_key="secret")

    payload = bridge.record_action("alpha", 2, 3, 1.5, ["Vaultfire", "NS3"])

    assert payload["loyalty_multiplier"] == 9.0
    assert commitments.exists()

    stored_text = commitments.read_text()
    assert "alpha" not in stored_text  # encrypted payload obscures plaintext

    revealed = bridge.reveal_commitments("secret")
    assert revealed[0]["action_id"] == "alpha"
    assert revealed[0]["commitment"] == payload["commitment"]


def test_plain_commitments(tmp_path: Path):
    commitments = tmp_path / "soul_commitments.json"
    bridge = SoulchainLoyaltyBridge(commitments_path=commitments)

    payload = bridge.record_action("beta", 1, 2, 3)

    assert payload["loyalty_multiplier"] == 6.0
    revealed = bridge.reveal_commitments()
    assert revealed[0]["action_id"] == "beta"
