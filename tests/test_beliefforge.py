"""Tests for the BeliefForge module."""

from cloak_pulse import CloakPulse
from utils.entropy_seed import EntropySeed

from vaultfire.modules.beliefforge import BeliefForge


def test_forge_signal_generates_moral_fingerprint() -> None:
    seed = EntropySeed(base_seed="belief-forge-test", debug=True)
    pulse = CloakPulse(seed, lineage="BeliefForgeTest", debug=True)
    forge = BeliefForge(cloak_pulse=pulse)
    record = forge.forge_signal(confidence=0.8, doubt=0.2, trust=0.9, context="unit-test")
    assert record["moral_fingerprint"]
    summary = forge.sync_ethics_engine()
    assert summary["signals_processed"] == 1
    assert summary["lineage_signature"].startswith("ghostkey316:")
