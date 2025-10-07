from __future__ import annotations

from datetime import datetime

from vaultfire.identity import GhostkeySignalBoost
from vaultfire.pilot_mode import (
    PilotBroadcastLayer,
    initialize_broadcast_layer,
)


def test_initialize_broadcast_layer_emits_receipt_and_status() -> None:
    GhostkeySignalBoost.clear_history()

    layer = initialize_broadcast_layer(
        stage="Pilot Trial Activation",
        signals={
            "public_post": "https://twitter.com/ghostkey316/status/1234567890",
            "repo": "https://github.com/Ghostkey316/ghostkey-316-vaultfire-init",
        },
        target_partners=[
            " OpenAI ",
            "Worldcoin",
            "Base",
            "Virtuals_io",
            "EncryptedDAO",
            "MPCFabric testers",
        ],
        sync_modules=[
            "MissionAnchoring",
            "TelemetryCompliance",
            "EthicsIdentityLoop",
        ],
        priority="urgent",
        broadcast_mode="stealth-handshake",
        initiator="Ghostkey-316",
        wallet="bpow20.cb.id",
    )

    assert isinstance(layer, PilotBroadcastLayer)
    assert layer.stage == "Pilot Trial Activation"
    assert layer.priority == "urgent"
    assert layer.broadcast_mode == "stealth-handshake"
    assert layer.target_partners == (
        "OpenAI",
        "Worldcoin",
        "Base",
        "Virtuals_io",
        "EncryptedDAO",
        "MPCFabric testers",
    )

    module_status = {module.name: module.status for module in layer.sync_modules}
    assert module_status["MissionAnchoring"] == "anchored"
    assert module_status["TelemetryCompliance"] == "calibrated"
    assert module_status["EthicsIdentityLoop"] == "verified"

    metadata = layer.broadcast_receipt.metadata
    assert metadata["handshake"] == layer.handshake_token
    assert metadata["stage"] == "Pilot Trial Activation"
    assert metadata["signals"]["repo"].startswith("https://github.com/")

    # Ensure the timestamp is ISO 8601 compliant.
    datetime.fromisoformat(metadata["activated_at"])


def test_initialize_broadcast_layer_produces_deterministic_handshake() -> None:
    GhostkeySignalBoost.clear_history()

    first = initialize_broadcast_layer(
        stage="Pilot Trial Activation",
        signals={
            "public_post": "https://twitter.com/ghostkey316/status/999",
            "repo": "https://github.com/Ghostkey316/ghostkey-316-vaultfire-init",
        },
        target_partners=["OpenAI", "Worldcoin"],
        sync_modules=["MissionAnchoring", "TelemetryCompliance"],
        priority="urgent",
        broadcast_mode="stealth-handshake",
        initiator="Ghostkey-316",
        wallet="bpow20.cb.id",
    )

    second = initialize_broadcast_layer(
        stage="Pilot Trial Activation",
        signals={
            "public_post": "https://twitter.com/ghostkey316/status/999",
            "repo": "https://github.com/Ghostkey316/ghostkey-316-vaultfire-init",
        },
        target_partners=["OpenAI", "Worldcoin"],
        sync_modules=["MissionAnchoring", "TelemetryCompliance"],
        priority="urgent",
        broadcast_mode="stealth-handshake",
        initiator="Ghostkey-316",
        wallet="bpow20.cb.id",
    )

    assert first.handshake_token == second.handshake_token
