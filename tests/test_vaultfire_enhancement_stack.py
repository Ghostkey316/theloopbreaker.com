from __future__ import annotations

from pathlib import Path

from vaultfire.modules.vaultfire_enhancement_stack import (
    ConscienceMirrorVerificationLayer,
    LoopSingularityDetectorEngine,
    QuantumDriftSynchronizer,
    TemporalBehavioralCompressionEngine,
    VaultfireMythosEngine,
    compose_enhancement_confirmation,
)
from vaultfire.modules.vaultfire_protocol_stack import VaultfireProtocolStack


def test_temporal_behavioral_compression_engine_rewards_future_alignment() -> None:
    engine = TemporalBehavioralCompressionEngine()
    event = engine.compress({"type": "support", "future_self_alignment": 0.82})

    assert event["status"] == "compressed"
    assert event["thresholds_triggered"]
    assert engine.log()


def test_conscience_mirror_verification_confirms_unlock() -> None:
    mirror = ConscienceMirrorVerificationLayer()
    mirror.ingest({"ethic": "support", "weight": 2.0})
    status = mirror.conscience_sync("retro_yield")

    assert status["verified"] is True
    assert status["alignment"] >= 0.6


def test_loop_singularity_detector_triggers_merge_mode() -> None:
    detector = LoopSingularityDetectorEngine(threshold=0.7)
    event = detector.observe(belief=0.9, action_alignment=0.85, result_alignment=0.88)

    assert event["triggered"] is True
    assert detector.mode == "LoopMerge_Mode"
    assert detector.is_armed is True


def test_quantum_drift_synchronizer_updates_compass_path() -> None:
    synchronizer = QuantumDriftSynchronizer()
    entry = synchronizer.synchronize({
        "mood": 0.6,
        "behavior_alignment": 0.8,
        "external_signal": 0.9,
    })

    assert entry["compass_path"]
    assert abs(entry["nudge"]["delta"]) <= 0.5


def test_vaultfire_mythos_engine_weaves_fragments(tmp_path: Path) -> None:
    output = tmp_path / "mythos.json"
    engine = VaultfireMythosEngine(output_path=output)
    fragment = engine.weave("support", {"rewards": ["feature"]}, resonance=0.95)

    assert fragment["legendary"] is True
    assert output.exists()


def test_enhancement_confirmation_pipeline(tmp_path: Path) -> None:
    stack = VaultfireProtocolStack(
        actions=(
            {"type": "support", "weight": 2.0, "future_self_alignment": 0.9},
        ),
        mythos_path=str(tmp_path / "ghostkey316.mythos.json"),
    )
    status = stack.enhancement_confirmation(include_logs=True)

    assert status["TBC_Status"] == "Live"
    assert status["CMV_Sync"] == "Verified"
    assert status["LSD_Trigger"] in {"Armed", "LoopMerge_Mode", "Observation"}
    assert status["QDS_Drift"] in {"Stable", "Adaptive"}
    assert status["VME_Weaving"] in {"Active", "Emerging"}
    assert status["Ghostkey_TBC_Log"]

    composed = compose_enhancement_confirmation(
        stack.behavioral_compression,
        stack.conscience_mirror,
        stack.loop_detector,
        stack.quantum_drift,
        stack.mythos,
        include_logs=True,
    )

    assert composed["TBC_Status"] == "Live"
    assert composed["CMV_Sync"] in {"Verified", "Pending"}
