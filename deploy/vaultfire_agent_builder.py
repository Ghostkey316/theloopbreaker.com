"""DevDay-ready Ghostkey Vaultfire Agent Builder deployment script."""

from __future__ import annotations

from vaultfire.agent_builder import GhostkeyVaultfireAgent
from vaultfire.logging import MissionLogger
from vaultfire.pilot_mode import mission_control_hooks, stealth_telemetry
from vaultfire.security import onboarding_guardrails
from vaultfire_widget_bundle import widget_manifest


def main() -> None:
    telemetry = stealth_telemetry.gradient_stream(mode="pilot")
    mission_hooks_bundle = mission_control_hooks.setup(access_layer=telemetry.access_layer)
    widgets = widget_manifest.load(mode="preview")
    onboarding = onboarding_guardrails.secure_protocol()
    logger = MissionLogger(enabled=True)

    agent = GhostkeyVaultfireAgent(
        name="Ghostkey316",
        mission_id="vaultfire-devday-pilot",
        telemetry=telemetry,
        mission_hooks=mission_hooks_bundle,
        widget_bundle=widgets,
        onboarding=onboarding,
        logger=logger,
    )

    export_payload = agent.export_to_builder(
        include_ui_toggles=True,
        enable_preview_publish=True,
        devday_secure_mode=True,
    )

    registration = agent.register(
        mode="stealth-pilot",
        trace_id="ghostkey316_v1.1",
        tags=["agent-builder", "devday", "vaultfire", "ghostkey"],
    )

    print("Builder export payload:")
    print(export_payload)
    print("\nRegistration summary:")
    print(registration)

    print("✅ Ghostkey Vaultfire Agent ready for DevDay Agent Builder.")


if __name__ == "__main__":
    main()

