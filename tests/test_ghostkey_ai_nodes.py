import pytest

from vaultfire.protocol.ghostkey_ai import GhostkeyAINetwork


def test_deploy_and_trigger_ghostkey_ai_node():
    network = GhostkeyAINetwork()
    node = network.deploy(wallet="ghostkey316.eth", function="Observe + Trigger Ethics Yield Boosts")
    assert node.wallet == "ghostkey316.eth"
    assert node.status == "passive"

    event = network.trigger_ethics_boost("ghostkey316.eth", ethics_score=0.92)
    assert event["status"] == "boosted"
    assert event["architect_wallet"] == "bpow20.cb.id"

    with pytest.raises(KeyError):
        network.trigger_ethics_boost("unknown.eth", ethics_score=1.0)
