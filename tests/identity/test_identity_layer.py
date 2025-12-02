from __future__ import annotations

from datetime import datetime

import pytest

from vaultfire.identity import (
    BeliefScoreEngine,
    IdentityEchoBridge,
    IdentityWeaveCore,
    PersonaMintCLI,
)
from vaultfire.memory import TimePulseSync
from vaultfire.soul import SoulPrintCore


def build_soulprint(soul_core: SoulPrintCore):
    return soul_core.generate(
        prompt_cadence=[0.1, 0.2, 0.3],
        mirror_echoes=["focus:0.2", "anchor:eth"],
        drift_patterns={"drift_score": 0.25},
        belief_deltas={"belief": 0.42},
        emotional_profile={"calm": 0.4, "focus": 0.3},
    )


def test_identity_hash_consistency_and_normalization():
    soul_core = SoulPrintCore(identity_ens="ghostkey316.eth")
    weave = IdentityWeaveCore(soul_core=soul_core)
    soulprint = build_soulprint(soul_core)
    anchor = weave.bind_snapshot(
        "ghostkey316.eth",
        soulprint=soulprint,
        identifiers={
            "social": ["@GhostKey316", " ghostkey316 "],
            "wallets": ["0xAbc"],
            "ens": ["Ghostkey316.eth"],
            "system": ["user-316"],
        },
    )
    repeated = weave.bind_snapshot(
        "GHOSTKEY316.ETH",
        soulprint=soulprint,
        identifiers={"wallets": ["0xabc"], "social": ["ghostkey316"]},
    )
    assert anchor.identity_hash == repeated.identity_hash
    merged = weave.merge_identity("ghostkey316.eth", identifiers={"ens": ["vaultfire.eth"]})
    assert merged.identity_hash != anchor.identity_hash
    assert "vaultfire.eth" in merged.identifiers["ens"]


def test_belief_score_engine_balances_signals():
    soul_core = SoulPrintCore()
    anchor = IdentityWeaveCore(soul_core=soul_core).bind_snapshot(
        "ghostkey316.eth", soulprint=build_soulprint(soul_core), identifiers={"ens": ["ghostkey316.eth"]}
    )
    engine = BeliefScoreEngine()
    score = engine.compute(
        anchor,
        activity_frequency=3,
        resonance_trail=[0.8, 0.6],
        ethics_alignment=0.9,
        continuity_threads=[{"weight": 0.7}, {"weight": 0.9}],
    )
    assert score.frequency == pytest.approx(0.4)
    assert score.resonance == pytest.approx(0.7)
    assert score.continuity == pytest.approx(0.8)
    assert score.composite == pytest.approx(195.92)


def test_identity_echo_bridge_mirrors_memory_and_resonance():
    pulse = TimePulseSync(block_span=120, time_source=lambda: datetime(2024, 1, 1, 12, 0, 0))
    soul_core = SoulPrintCore()
    anchor = IdentityWeaveCore(soul_core=soul_core).bind_snapshot(
        "ghostkey316.eth", soulprint=build_soulprint(soul_core), identifiers={"ens": ["ghostkey316.eth"]}
    )
    bridge = IdentityEchoBridge(time_pulse=pulse)
    mirrored = bridge.mirror(
        anchor,
        prompt="align",
        heart_rate=78,
        galvanic_skin_response=0.52,
        voice_tremor=0.09,
        emotional_delta={"focus": 0.2},
        ethics_alignment=0.88,
    )
    assert mirrored["identity_hash"] == anchor.identity_hash
    assert mirrored["belief"]["continuity"] >= 0
    assert mirrored["continuity_profile"]["ordinal"] == int(pulse.anchor().block_start.timestamp()) // 120


def test_persona_mint_cli_exports_multiple_formats():
    soul_core = SoulPrintCore()
    identity_core = IdentityWeaveCore(soul_core=soul_core)
    anchor = identity_core.bind_snapshot(
        "ghostkey316.eth", soulprint=build_soulprint(soul_core), identifiers={"ens": ["ghostkey316.eth"]}
    )
    cli = PersonaMintCLI(identity_core=identity_core)
    json_export = cli.export(
        "ghostkey316.eth",
        zk_privacy=True,
        resonance_trail=[0.9, 0.8],
        ethics_alignment=0.95,
    )
    assert json_export["identity_hash"] == anchor.identity_hash
    assert "zk_proof" in json_export
    vault_export = cli.export(
        "ghostkey316.eth", export_format="vault", zk_privacy=True, resonance_trail=[0.9]
    )
    assert vault_export["filename"].endswith(".vault")
    assert vault_export["stealth"] is True
    assert "sealed" in vault_export
