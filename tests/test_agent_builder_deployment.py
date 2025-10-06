from __future__ import annotations

from pathlib import Path

from vaultfire.agent_builder import GhostkeyVaultfireAgent
from vaultfire.logging import MissionLogger
from vaultfire.pilot_mode import mission_control_hooks, stealth_telemetry
from vaultfire.security import onboarding_guardrails
from vaultfire_widget_bundle import stream_loader, widget_manifest


def _bootstrap_agent(tmp_path: Path) -> GhostkeyVaultfireAgent:
    telemetry = stealth_telemetry.gradient_stream(mode="pilot", base_path=tmp_path)
    mission_hooks_bundle = mission_control_hooks.setup(access_layer=telemetry.access_layer)
    widgets = widget_manifest.load(mode="preview")
    onboarding = onboarding_guardrails.secure_protocol()
    logger = MissionLogger(enabled=True)
    return GhostkeyVaultfireAgent(
        name="Ghostkey316",
        mission_id="vaultfire-devday-pilot",
        telemetry=telemetry,
        mission_hooks=mission_hooks_bundle,
        widget_bundle=widgets,
        onboarding=onboarding,
        logger=logger,
    )


def test_builder_export_contains_manifest(tmp_path: Path) -> None:
    agent = _bootstrap_agent(tmp_path)

    payload = agent.export_to_builder(
        include_ui_toggles=True,
        enable_preview_publish=True,
        devday_secure_mode=True,
    )

    assert payload["agent"]["name"] == "Ghostkey316"
    assert payload["telemetry"]["mode"] == "pilot"
    assert payload["widget_manifest"]["mode"] == "preview"
    assert payload["widget_manifest"]["ui_toggles"]  # toggles included
    assert payload["onboarding"]["secure_mode"] is True


def test_registration_and_streaming(tmp_path: Path) -> None:
    agent = _bootstrap_agent(tmp_path)

    export = agent.export_to_builder(include_ui_toggles=False)
    assert export["telemetry"]["gradient_window_seconds"] == agent.telemetry.gradient_window_seconds

    # Onboard and activate a pilot session
    onboarding = agent.pilot_agent.onboard_contributor(
        "ghost-partner",
        api_keys=["ghost-api"],
        wallet_addresses=["0xABC"],
        metadata={"tier": "pilot"},
        watermark=True,
    )
    protocol_key = onboarding["protocol_key"]
    session = agent.pilot_agent.verify_trust(
        "ghost-partner",
        protocol_key=protocol_key,
        api_key="ghost-api",
        protocols=("Vaultfire", "Pilot"),
    )

    partner_profile = {
        "ens": "ghostpartner.eth",
        "mission": "Belief-secured intelligence for partners who lead with ethics.",
        "missionTags": ["vaultfire", "devday"],
        "beliefDensity": 0.91,
        "empathyScore": 0.82,
        "ethicsVerified": True,
        "tags": ["agent-builder", "devday"],
    }
    launch_record = agent.mission_hooks.on_session_launch(
        session,
        partner_profile=partner_profile,
    )
    assert "reference_id" in launch_record

    stealth_payload = agent.mission_hooks.on_stealth_activation(
        session,
        allow_confidential_sessions=True,
        auto_expire_on_signal_mismatch=True,
    )
    agent.log_stealth_activation(session.session_id, stealth_payload)

    packets = list(
        stream_loader.build_streamer(
            agent.telemetry,
            session,
            include_session_state=True,
        )
    )
    assert packets, "expected telemetry packets"
    assert packets[0].channel == "gradient"

    registration = agent.register(
        mode="stealth-pilot",
        trace_id="ghostkey316_v1.1",
        tags=["agent-builder", "devday"],
    )
    assert registration["mode"] == "stealth-pilot"
    assert registration["resonance"]["signal_count"] >= 0

    last_log = agent.logger.last()
    assert last_log and last_log["event"] == "agent-registered"

