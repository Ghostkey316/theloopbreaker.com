"""Agent Builder orchestration helpers for Ghostkey Vaultfire deployments."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Mapping, Optional, Sequence

from vaultfire.enterprise.mission_control import EnterpriseMissionControl
from vaultfire.pilot_mode.ghostkey_agent import GhostkeyVaultfireAgent as PilotGhostkeyVaultfireAgent
from vaultfire.pilot_mode.stealth_telemetry import StealthTelemetryBundle
from vaultfire.pilot_mode.mission_control_hooks import MissionControlHookBundle
from vaultfire_widget_bundle.widget_manifest import WidgetBundle
from vaultfire.security.onboarding_guardrails import OnboardingGuardrails
from vaultfire.logging import MissionLogger

__all__ = ["GhostkeyVaultfireAgent"]


@dataclass
class BuilderExport:
    """Structured payload exported to the Agent Builder UI."""

    agent: Mapping[str, object]
    telemetry: Mapping[str, object]
    widget_manifest: Mapping[str, object]
    onboarding: Mapping[str, object]
    secure_mode: bool
    preview_publish: bool

    def export(self) -> Mapping[str, object]:
        payload = {
            "agent": dict(self.agent),
            "telemetry": dict(self.telemetry),
            "widget_manifest": dict(self.widget_manifest),
            "onboarding": dict(self.onboarding),
            "secure_mode": self.secure_mode,
            "preview_publish": self.preview_publish,
        }
        return payload


@dataclass
class RegistrationRecord:
    """Registration metadata emitted after DevDay sync."""

    mode: str
    trace_id: str
    tags: Sequence[str]
    mission_control: Mapping[str, object]
    resonance: Mapping[str, object]
    widgets: Mapping[str, Mapping[str, object]]

    def export(self) -> Mapping[str, object]:
        return {
            "mode": self.mode,
            "trace_id": self.trace_id,
            "tags": list(self.tags),
            "mission_control": dict(self.mission_control),
            "resonance": dict(self.resonance),
            "widgets": {key: dict(value) for key, value in self.widgets.items()},
        }


class GhostkeyVaultfireAgent:
    """High-level Agent Builder facade for Ghostkey Vaultfire deployments."""

    def __init__(
        self,
        *,
        name: str,
        mission_id: str,
        telemetry: StealthTelemetryBundle,
        mission_hooks: MissionControlHookBundle,
        widget_bundle: WidgetBundle,
        onboarding: OnboardingGuardrails,
        logger: MissionLogger,
        mission_control: Optional[EnterpriseMissionControl] = None,
    ) -> None:
        self.name = name
        self.mission_id = mission_id
        self.telemetry = telemetry
        self.widget_bundle = widget_bundle
        self.onboarding = onboarding
        self.logger = logger
        self._mission_control = mission_control or EnterpriseMissionControl()
        self._pilot_agent = PilotGhostkeyVaultfireAgent(
            access_layer=self.telemetry.access_layer,
            mission_control=self._mission_control,
        )
        self._mission_hooks = mission_hooks
        self._mission_hooks.rebind(self.telemetry.access_layer, mission_control=self._mission_control)
        self._last_export: Optional[BuilderExport] = None
        self._registration_log: List[RegistrationRecord] = []
        self.logger.log(
            "agent-initialised",
            name=self.name,
            mission_id=self.mission_id,
            telemetry_mode=self.telemetry.mode,
            gradient_window_seconds=self.telemetry.gradient_window_seconds,
        )

    # ------------------------------------------------------------------
    # Public accessors
    # ------------------------------------------------------------------
    @property
    def pilot_agent(self) -> PilotGhostkeyVaultfireAgent:
        """Return the underlying pilot-mode agent instance."""

        return self._pilot_agent

    @property
    def mission_hooks(self) -> MissionControlHookBundle:
        """Expose the mission control hook bundle."""

        return self._mission_hooks

    @property
    def exports(self) -> Optional[BuilderExport]:
        """Return the last exported Builder payload."""

        return self._last_export

    @property
    def registrations(self) -> Sequence[RegistrationRecord]:
        """Return historical registration records."""

        return tuple(self._registration_log)

    # ------------------------------------------------------------------
    # Builder integration
    # ------------------------------------------------------------------
    def export_to_builder(
        self,
        *,
        include_ui_toggles: bool = False,
        enable_preview_publish: bool = False,
        devday_secure_mode: bool = False,
    ) -> Mapping[str, object]:
        """Materialise the payload consumed by the Agent Builder interface."""

        agent_payload = {
            "name": self.name,
            "mission_id": self.mission_id,
            "mission": self._mission_control.mission,
            "widgets": [widget.name for widget in self._pilot_agent.config.widgets],
        }
        telemetry_payload = {
            "mode": self.telemetry.mode,
            "gradient_window_seconds": self.telemetry.gradient_window_seconds,
            "accepted_enclaves": self.telemetry.accepted_enclaves,
        }
        widget_payload = self.widget_bundle.export(include_ui_toggles=include_ui_toggles)
        onboarding_payload = self.onboarding.export()
        export = BuilderExport(
            agent=agent_payload,
            telemetry=telemetry_payload,
            widget_manifest=widget_payload,
            onboarding=onboarding_payload,
            secure_mode=bool(devday_secure_mode),
            preview_publish=bool(enable_preview_publish),
        )
        self._last_export = export
        self.logger.log(
            "builder-export",
            secure_mode=devday_secure_mode,
            preview_publish=enable_preview_publish,
            include_ui_toggles=include_ui_toggles,
        )
        return export.export()

    def register(
        self,
        *,
        mode: str,
        trace_id: str,
        tags: Iterable[str],
    ) -> Mapping[str, object]:
        """Register the agent for a deployment window and log mission state."""

        launch_state = self._pilot_agent.launch(mode=mode, sync_with_devday_tools=True)
        record = RegistrationRecord(
            mode=mode,
            trace_id=trace_id,
            tags=tuple(tags),
            mission_control=launch_state.mission_commitments,
            resonance=launch_state.resonance_digest,
            widgets=launch_state.widgets,
        )
        self._registration_log.append(record)
        self.logger.log(
            "agent-registered",
            mode=mode,
            trace_id=trace_id,
            tags=list(tags),
            resonance=launch_state.resonance_digest,
        )
        return record.export()

    def log_stealth_activation(
        self,
        session_id: str,
        payload,
    ) -> None:
        """Relay a stealth activation payload through the mission logger."""

        if hasattr(payload, "export"):
            payload_dict = payload.export()  # type: ignore[call-arg]
        else:
            payload_dict = dict(payload)
        self.logger.log(
            "stealth-activation",
            session_id=session_id,
            mission_reference=dict(payload_dict.get("mission_reference", {})),
            options=dict(payload_dict.get("options", {})),
        )

