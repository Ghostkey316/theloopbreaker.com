from vaultfire.core.cli import GhostkeyCLI
from vaultfire.modules.vaultfire_enhancement_stack import EnhancementConfirmComposer
from vaultfire.modules.vaultfire_protocol_stack import VaultfireProtocolStack


def test_protocol_stack_tracks_moral_equilibrium_loop():
    GhostkeyCLI.reset()
    stack = VaultfireProtocolStack(actions=())

    stack._ingest_action(
        {
            "interaction_id": "loop-1",
            "type": "compassion-support",
            "ethic": "support",
            "confidence": 0.88,
            "alignment_bias": 0.2,
            "consent": True,
            "tags": ("support", "urgent"),
            "distress": 0.75,
            "statement": "Aid request verified",
        }
    )

    telemetry = stack.moral_telemetry()
    assert telemetry
    last_frame = telemetry[-1]
    assert last_frame["equilibrium"]["equilibrium"] <= 1.0
    assert last_frame["truthfield"]["bias_index"] >= 0.0
    assert last_frame["compassion"]["level"] >= stack.compassion_overdrive.status()["base_level"]

    manifest_modules = {entry["module"] for entry in stack.integration_manifest}
    assert {"CognitiveEquilibriumEngine", "TruthfieldResonator", "CompassionOverdriveLayer"}.issubset(
        manifest_modules
    )

    sources = EnhancementConfirmComposer.status()["sources"]
    for label in ("CognitiveEquilibriumEngine", "TruthfieldResonator", "CompassionOverdriveLayer"):
        assert label in sources

    commands = GhostkeyCLI.manifest()["commands"]
    assert "truthfield verify" in commands
    assert "ethics monitor --auto-correct" in commands

    summary = stack.pulsewatch()
    assert "moral_equilibrium" in summary
    assert "adaptive_cycle" in summary
