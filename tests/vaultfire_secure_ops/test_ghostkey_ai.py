from __future__ import annotations

from vaultfire.mission import MissionLedger
from vaultfire.protocol.ghostkey_ai import GhostkeyAINetwork


def test_ai_network_persists_and_rehydrates(tmp_path):
    ledger = MissionLedger(path=tmp_path / "ai-ledger.jsonl", component="ghostkey-ai")

    network = GhostkeyAINetwork(ledger=ledger, regions=("us-east", "eu-west"))
    node = network.deploy(
        wallet="ghostkey316.eth",
        function="Observe + Trigger Ethics Yield Boosts",
        region="us-east",
        partner_id="partner-x",
        diligence_artifacts=("artifact://ghostkey316",),
    )

    event = network.trigger_ethics_boost("ghostkey316.eth", ethics_score=0.82)
    assert event["status"] == "boosted"
    assert ledger.lookup(node.ledger_reference) is not None

    diagnostics = network.failover_diagnostics()
    assert any(snapshot["region"] == "us-east" for snapshot in diagnostics)

    snapshot = network.integrity_snapshot()
    assert snapshot[0]["ledger_verified"] is True

    # Rehydrate from ledger to ensure durability
    network_rehydrated = GhostkeyAINetwork(ledger=ledger, regions=("us-east", "eu-west"))
    restored_node = network_rehydrated.get_node("ghostkey316.eth")
    assert restored_node is not None
    assert restored_node.ledger_reference == node.ledger_reference
