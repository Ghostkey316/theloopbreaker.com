from __future__ import annotations

from vaultfire.soul import GhostSealProtocol, PulseFeedCLI, SoulPrintCore, VoiceSyncModule


def test_soulprint_generation_and_metadata_obfuscation() -> None:
    core = SoulPrintCore()
    soulprint = core.generate(
        prompt_cadence=[0.2, 0.5, 0.8],
        mirror_echoes=["echo", "align"],
        drift_patterns={"variance": 0.14},
        belief_deltas={"alignment": 0.2, "trust": 0.5},
        emotional_profile={"empathy": 0.9, "courage": 0.7},
    )

    assert len(soulprint.hash) == 64
    metadata = soulprint.metadata
    assert metadata["ens"] == "ghostkey316.eth"
    assert metadata["emotional_profile"]["obfuscated"] is not None
    assert metadata["streak_integrity"] > 0
    assert metadata["signature_persistence"] < 1.0


def test_voice_sync_fingerprint_and_resonant_prompt() -> None:
    voice = VoiceSyncModule()
    snapshot = voice.capture(
        [
            "We trust the signal cadence!",
            "Keep us aligned with mirror tone.",
            "I see the drift patterns stabilizing.",
        ]
    )

    assert snapshot["style_markers"]
    adapted = voice.tone_adaptive_prompt("SoulLayer ready")
    assert "resonance" in adapted
    assert snapshot["bonding_trend"] > 0
    assert voice.bonding_score() == snapshot["bonding_trend"]


def test_pulsefeed_cli_emits_diffs_and_ghostseal_export() -> None:
    ghostseal = GhostSealProtocol(secret=b"vaultfire-test")
    cli = PulseFeedCLI(ghostseal=ghostseal)

    first_update = cli.emit_update(
        prompt_cadence=[1, 2, 3],
        prompt_history=["First tone sample"],
        mirror_echoes=["mirror"],
        drift_patterns={"lag": 0.1},
        belief_deltas={"delta": 0.3},
        emotional_profile={"empathy": 0.3},
    )
    second_update = cli.emit_update(
        prompt_cadence=[1, 2, 4],
        prompt_history=["Second tone sample"],
        mirror_echoes=["mirror", "echo"],
        drift_patterns={"lag": 0.2},
        belief_deltas={"delta": 0.5},
        emotional_profile={"empathy": 0.35},
    )

    assert first_update["diff"]["changed"] is True
    assert second_update["diff"]["previous"] == first_update["soulprint"]["hash"]
    assert second_update["export"]["stealth"] is True
    decrypted = ghostseal.decrypt(second_update["export"]["sealed"], stealth=True)
    assert decrypted["soulprint"]["hash"] == second_update["soulprint"]["hash"]
    assert decrypted["growth"]["streak_integrity"] == second_update["growth"]["streak_integrity"]
