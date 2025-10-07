"""Tests for the context matrix helpers."""

from __future__ import annotations

from vaultfire.context_matrix import BeliefAnchor, ContextNode, LinkSpanner, RecallBridge


def test_context_matrix_workflow() -> None:
    ctx = ContextNode(
        identity="Ghostkey-316",
        scope="perpetual",
        priority=["emotional shifts", "key choices", "moral moments"],
    )
    event = ctx.record_event(
        "user affirmed mission",
        tags=["moral", "alignment"],
        signal={"intensity": 0.87},
    )
    assert event["description"] == "user affirmed mission"
    assert event["tags"] == ("moral", "alignment")
    assert ctx.priority == ("emotional shifts", "key choices", "moral moments")

    anchor = BeliefAnchor(log="ghostkey_manifesto", mode="reinforced")
    anchor_entry = anchor.bind("alignment oath recorded", weight=0.9)
    assert anchor.mode == "reinforced"
    assert anchor_entry["confidence"] == 0.9

    spanner = LinkSpanner(window="all", relevance_threshold=0.72)
    link = spanner.link(ctx, anchor, confidence=0.8, note="historic reference")
    assert link["status"] == "linked"
    assert len(spanner.links) == 1

    bridge = RecallBridge(trigger_mode="contextual", fallback="SignalCompass")
    dispatch = bridge.dispatch("alignment-ping", context=link)
    assert dispatch["route"] == "alignment-ping"
    assert bridge.status == "LIVE"

    bridge.suspend()
    assert bridge.status == "PAUSED"
    bridge.resume()
    assert bridge.status == "LIVE"
