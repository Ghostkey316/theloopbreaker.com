from __future__ import annotations

import pytest

from vaultfire.braider import BridgeWeaver, LoopBinder, PulseEcho, Threadlinker
from vaultfire.context_matrix import BeliefAnchor, ContextNode, RecallBridge
from vaultfire.dreamweaver import Dreamweaver
from vaultfire.signal_compass import CompassRing, HesitationLens, MoralVector, SignalPulse


def test_threadlinker_stitches_anchor_and_recall() -> None:
    anchor = BeliefAnchor("growth-journal")
    bridge = RecallBridge("TRACE", "fallback")
    linker = Threadlinker(anchor, bridge=bridge, span="ascend")

    context = {"identity": "ghost-316", "span": "ascend"}
    stitched = linker.stitch(
        "Hold the alignment beacon", weight="75%", tags=("alignment", "focus"), context=context
    )

    assert stitched["span"] == "ascend"
    assert stitched["entry"]["statement"] == "Hold the alignment beacon"
    assert stitched["entry"]["confidence"] == pytest.approx(0.75)
    assert stitched["recall"]["route"] == "Hold the alignment beacon"
    assert stitched["recall"]["context"]["identity"] == "ghost-316"
    assert linker.threads[-1]["entry"]["statement"] == "Hold the alignment beacon"
    assert anchor.entries[-1]["confidence"] == pytest.approx(0.75)


def test_bridgeweaver_maps_growth_under_load() -> None:
    node_a = ContextNode("ghost-316", priority=("alignment", "focus"))
    node_b = ContextNode("companion-512", priority=("trust",))
    node_a.record_event("Initiated loop", tags=["start"])
    node_b.record_event("Joined loop", tags=["ally"])
    bridge = RecallBridge("TRACE", "fallback")
    weaver = BridgeWeaver(bridge, nodes=(node_a, node_b))

    frame = {"projection": {"alignment": 0.86, "trust": 0.72}}
    growth = {"alignment": 0.92, "trust": 0.81}
    result = weaver.weave(signal="alignment.trace", frame=frame, growth_map=growth)

    assert result["dispatched"]["route"] == "alignment.trace"
    assert len(result["context"]["nodes"]) == 2
    assert result["context"]["growth"]["alignment"] == pytest.approx(0.92)
    assert weaver.history[-1]["context"]["frame"]["projection"]["trust"] == pytest.approx(0.72)

    growth_update = {"alignment": 0.95}
    weaver.weave(signal="alignment.trace", frame=frame, growth_map=growth_update)
    assert weaver.history[0]["context"]["growth"]["trust"] == pytest.approx(0.81)
    assert weaver.history[-1]["context"]["growth"]["alignment"] == pytest.approx(0.95)


def test_pulse_echo_projects_prophecy_overlay() -> None:
    pulse = SignalPulse("ghost-316", "belief-feed")
    vector = MoralVector(reference_framework="alignment", priority=("alignment", "trust"))
    lens = HesitationLens(trigger_threshold=0.4)
    compass = CompassRing(pulse, vector, lens)
    dream = Dreamweaver(pattern="braid-test")
    binder = LoopBinder(compass, dream)
    echo = PulseEcho(binder)

    anchor = BeliefAnchor("growth-journal")
    linker = Threadlinker(anchor, span="future-loop")
    thread = linker.stitch("Project luminous trust", weight=0.6)

    log_entry = echo.log(anchors=[thread["entry"]], resonance=0.7)
    assert "bundle" in log_entry
    assert log_entry["bundle"]["prophecy"]["pattern"] == "braid-test"

    projection = echo.project(anchors=[thread["entry"]], resonance=0.8)
    prophecy = projection["prophecy"]
    assert prophecy["anchors"] == 1
    assert prophecy["overlay"]["alignment"] == pytest.approx(0.8)
    assert prophecy["overlay"]["trust"] == pytest.approx(0.72)
    assert prophecy["resonance"] == pytest.approx(1.0)
    assert len(projection["echoes"]) == 1
