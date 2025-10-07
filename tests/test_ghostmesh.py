from __future__ import annotations

import logging

import pytest

from vaultfire.ghostmesh import GhostNode, build_identity_map


def test_identity_map_auto_detects_ghostkey316() -> None:
    mesh = build_identity_map()
    assert "Ghostkey-316" in mesh
    node = mesh["Ghostkey-316"]
    assert isinstance(node, GhostNode)
    assert node.legacy_unlocked is True
    assert "legacy-unlock" in node.prophecy_triggers
    # Ensure default handles include the toolchain for the GhostKey mesh
    for handle in ("tools:ghost", "tools:intent", "tools:pulse", "tools:forklog"):
        assert handle in node.handles


def test_state_sync_across_layers(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="vaultfire.ghostkey")
    mesh = build_identity_map()
    node = mesh["Ghostkey-316"]

    node.ingest_signal(
        layer="CLI",
        signal={"command": "tools:ghost"},
        intent="activate-mesh",
        loyalty=0.91,
        growth=0.04,
        metadata={"channel": "cli"},
    )
    node.ingest_signal(
        layer="Mirrorframe",
        signal={"mirror": "purpose-align"},
        intent="mirror-sync",
        fork={"reason": "mirror-phase", "next_intent": "braider-weave"},
        loyalty=0.87,
        metadata={"channel": "mirror"},
    )
    node.ingest_signal(
        layer="Braider",
        signal={"braid": "intent-weave"},
        intent="braider-weave",
        divergence="mirror-latency",
        loyalty=0.88,
        metadata={"channel": "braider"},
    )
    node.ingest_signal(
        layer="RetroYield",
        signal={"yield": "retro-sync"},
        intent="retroyield-sync",
        loyalty=0.95,
        fork={"reason": "retro-branch", "next_intent": "mission-rise", "belief": "retro-growth"},
        growth=0.06,
        metadata={"channel": "retroyield"},
    )

    state = node.state_sync()
    assert set(state["layers"]) == {"CLI", "Mirrorframe", "Braider", "RetroYield"}
    assert len(state["memory"]) == 4
    assert len(state["intent_path"]) >= 4
    assert pytest.approx(state["loyalty"]["average"], rel=1e-3) == pytest.approx(0.9025, rel=1e-3)
    assert len(state["loyalty"]["trajectory"]) == 4
    assert len(state["forks"]["forks"]) == 2
    assert len(state["forks"]["growth"]) == 2

    recorded_layers = [record.ghostkey["layer"] for record in caplog.records if hasattr(record, "ghostkey")]
    assert recorded_layers == ["CLI", "Mirrorframe", "Braider", "RetroYield"]
