from __future__ import annotations

from vaultfire.sensation import (
    EchoBridgeIntegration,
    HapticSyncModule,
    SensePulseCLI,
    SenseWeaveCore,
)


def test_biometric_hash_and_score_stability() -> None:
    core = SenseWeaveCore()

    first = core.capture(
        heart_rate=72,
        galvanic_skin_response=0.44,
        voice_tremor=0.12,
        emotional_delta={"empathy": 0.2},
    )
    second = core.capture(
        heart_rate=72,
        galvanic_skin_response=0.44,
        voice_tremor=0.12,
        emotional_delta={"empathy": 0.2},
    )

    assert first.hash == second.hash
    assert first.sensation_score == second.sensation_score
    assert first.resonance == second.resonance


def test_echo_bridge_syncs_with_drift_and_soulprint() -> None:
    core = SenseWeaveCore()
    snapshot = core.capture(
        heart_rate=80,
        galvanic_skin_response=0.65,
        voice_tremor=0.2,
        emotional_delta={"trust": 0.3, "calm": 0.1},
    )

    bridge = EchoBridgeIntegration()
    result = bridge.sync("user-316", snapshot, prompt_anchor="mirror-tone")

    assert result["soulprint"].metadata["mirror_echo_count"] >= 1
    assert result["drift_metrics"].drift_score >= 0
    assert 0 < result["anchors"]["prompt_weight"] <= 1.0
    assert result["bonding_response"] >= 0


def test_haptic_fallback_and_cli_export() -> None:
    haptics = HapticSyncModule(hardware_available=False)
    response = haptics.emit(warmth=0.5, pulse=0.2, tremor=0.4, anchor="align")

    assert response["status"] == "simulated"
    assert "fallback" in response
    assert response["effect"]["waveform"]["intensity"] > 0

    core = SenseWeaveCore()
    snapshot = core.capture(
        heart_rate=70,
        galvanic_skin_response=0.5,
        voice_tremor=0.1,
    )
    cli = SensePulseCLI()
    export = cli.export_snapshot(
        user_id="user-ghost",
        snapshot=snapshot,
        soulprint_hash="deadbeef",
    )

    assert export["sealed"]["cross_chain_ready"] is True
    decrypted = cli.ghostseal.decrypt(export["sealed"]["sealed"], stealth=True)
    assert decrypted["resonance"]["hash"] == snapshot.hash
    assert decrypted["metadata"]["sensation_score"] == snapshot.sensation_score
