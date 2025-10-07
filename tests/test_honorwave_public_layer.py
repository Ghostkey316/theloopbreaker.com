from __future__ import annotations

from vaultfire.honorwave import (
    HonorWaveRegistry,
    HonorWaveScorer,
    Mirrorwave,
    activate_module,
)


def test_public_honor_layer_activation_flow() -> None:
    module = activate_module("vaultfire.honorwave")
    assert module.Mirrorwave.status == "OFFLINE"

    Mirrorwave.reset()

    signature = HonorWaveRegistry.load_signature(
        source="SoulSuite", signature="Ghostkey-316"
    )
    assert signature.signature == "Ghostkey-316"

    Mirrorwave.enable_public_layer(
        trust_anchor="ghostkey316.eth",
        signature_preview=True,
        live_feed=True,
        honor_score_visible=True,
        trail_access="read-only",
    )

    weights = HonorWaveScorer.initialize(
        weight_factors={
            "ethics_actions": 0.4,
            "compassion_logs": 0.3,
            "protocol_contributions": 0.2,
            "public_resonance": 0.1,
        },
        sync_with="vaultfire.protocol_status",
    )
    assert set(weights) == {
        "ethics_actions",
        "compassion_logs",
        "protocol_contributions",
        "public_resonance",
    }
    assert round(sum(weights.values()), 6) == 1.0

    signal = Mirrorwave.broadcast(
        from_identity="Ghostkey-316",
        message=(
            "Public moral identity confirmed. Vaultfire stands for truth, ethics, "
            "and belief-driven evolution."
        ),
        tag=["trust_anchor", "honor_beacon", "origin_fingerprint"],
    )
    assert signal["from"] == "Ghostkey-316"
    assert "honor_beacon" in signal["tags"]

    path = Mirrorwave.launch_ui(path="/honorwave/ghostkey316")
    assert path == "/honorwave/ghostkey316"

    snapshot = Mirrorwave.snapshot()
    assert snapshot["status"] == "LIVE"
    assert snapshot["config"]["trust_anchor"] == "ghostkey316.eth"
    assert snapshot["ui_path"] == "/honorwave/ghostkey316"
    assert snapshot["broadcasts"], "expected at least one broadcast entry"
