"""Ghostkey Vaultfire agent orchestration helpers for Agent Builder integration.

This module wires the existing pilot mode infrastructure together so the
"Ghostkey Vaultfire Agent" described in the DevDay rollout brief can be
instantiated programmatically.  The agent surface coordinates Mission
Control Points (MCP), ChatKit-style widgets, stealth pilot toggles, and
Codex integrity reporting on top of :class:`~vaultfire.pilot_mode.PilotAccessLayer`.

It intentionally avoids network calls and keeps all behaviour deterministic
so automated tests and CI can exercise the flows without external services.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, Mapping, MutableMapping, Optional, Tuple

from vaultfire.enterprise.mission_control import EnterpriseMissionControl

from .access_layer import PilotAccessLayer
from .privacy import PilotPrivacyLedger
from .resonance import PilotResonanceTelemetry
from .session import PilotSession

__all__ = [
    "AgentWidget",
    "AgentWorkflow",
    "AgentConfig",
    "AgentLaunchState",
    "MissionControlPoints",
    "GhostkeyVaultfireAgent",
]


@dataclass(frozen=True)
class AgentWidget:
    """Representation of a ChatKit widget exposed by the agent."""

    name: str
    description: str
    config: Mapping[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentWorkflow:
    """Metadata for an agentic workflow that can be triggered."""

    name: str
    description: str


@dataclass(frozen=True)
class AgentConfig:
    """Static configuration for the Ghostkey Vaultfire agent."""

    name: str
    instructions: str
    codex_integrity: str
    model: str
    temperature: float
    tools: Tuple[str, ...]
    widgets: Tuple[AgentWidget, ...]
    workflows: Tuple[AgentWorkflow, ...]


@dataclass
class AgentLaunchState:
    """Runtime state emitted after :meth:`GhostkeyVaultfireAgent.launch`."""

    mode: str
    sync_with_devday_tools: bool
    resonance_digest: Dict[str, object]
    resonance_configuration: Dict[str, object]
    mission_commitments: Dict[str, object]
    codex_integrity: str
    tools: Tuple[str, ...]
    widgets: Dict[str, Dict[str, object]]


class MissionControlPoints:
    """Utility for logging Mission Control telemetry references."""

    def __init__(
        self,
        *,
        ledger: PilotPrivacyLedger,
        telemetry: PilotResonanceTelemetry,
    ) -> None:
        self._ledger = ledger
        self._telemetry = telemetry

    def log_resonance(self, *, partner_tag: str, session_id: str) -> Dict[str, object]:
        """Persist a resonance digest to the pilot ledger and return metadata."""

        digest = self._telemetry.integrity_digest()
        reference = self._ledger.record_reference(
            partner_tag=partner_tag,
            reference_type="mission-control",
            payload=digest,
            metadata={
                "component": "resonance-telemetry",
                "session_id": session_id,
                "mcp": True,
            },
        )
        return {"reference_id": reference.reference_id, "digest": digest}


class GhostkeyVaultfireAgent:
    """High-level orchestrator for the Ghostkey Vaultfire Agent."""

    def __init__(
        self,
        *,
        access_layer: PilotAccessLayer,
        mission_control: Optional[EnterpriseMissionControl] = None,
        config: Optional[AgentConfig] = None,
    ) -> None:
        self._access_layer = access_layer
        self._mission_control = mission_control or EnterpriseMissionControl()
        self._telemetry = access_layer.resonance
        self._ledger = access_layer.ledger
        self._mcp = MissionControlPoints(ledger=self._ledger, telemetry=self._telemetry)
        self._active_sessions: Dict[str, PilotSession] = {}
        self._stealth_sessions: Dict[str, Dict[str, object]] = {}
        self._widget_state: Dict[str, Dict[str, object]] = {}
        self._last_display: Optional[str] = None
        self._resonance_configuration: Dict[str, object] = {}

        if config is None:
            config = AgentConfig(
                name="Ghostkey Vaultfire Agent",
                instructions=(
                    "You are the origin agent of Vaultfire. Your mission is to run "
                    "belief-based loyalty flows, activate passive systems, validate "
                    "contributors via telemetry, and prepare for global rollout."
                ),
                codex_integrity="10/10",
                model="gpt-4o",
                temperature=0.2,
                tools=("MCP", "ChatKit", "StealthPilot", "VaultfireCodex"),
                widgets=(
                    AgentWidget(
                        name="YieldDashboard",
                        description="Passive yield telemetry overview",
                        config={"bind_wallet": "bpow20.cb.id"},
                    ),
                    AgentWidget(
                        name="ContributorScanner",
                        description="Contributor verification panel",
                        config={"mode": "passive"},
                    ),
                    AgentWidget(
                        name="RoleGate",
                        description="Role interface for Ghostkey lineage checks",
                        config={"default_role": "Ghostkey-316"},
                    ),
                    AgentWidget(
                        name="ResonanceLogs",
                        description="Mission resonance telemetry feed",
                        config={"store_in_codex": True},
                    ),
                ),
                workflows=(
                    AgentWorkflow(
                        name="PilotFlow",
                        description="Activate pilot sessions with telemetry guards",
                    ),
                    AgentWorkflow(
                        name="ContributorOnboarding",
                        description="Automate contributor validation and access keys",
                    ),
                    AgentWorkflow(
                        name="YieldAudit",
                        description="Run passive yield audits via sandbox simulations",
                    ),
                    AgentWorkflow(
                        name="ResonanceTelemetry",
                        description="Stream resonance gradients into Mission Control",
                    ),
                ),
            )
        self.config = config

    # ------------------------------------------------------------------
    # Public properties
    # ------------------------------------------------------------------
    @property
    def mission(self) -> str:
        """Return the mission statement bound to the agent."""

        return self._mission_control.mission

    @property
    def widgets_summary(self) -> Mapping[str, Dict[str, object]]:
        """Return the most recent widget activation status."""

        return dict(self._widget_state)

    @property
    def stealth_sessions(self) -> Mapping[str, Dict[str, object]]:
        """Return metadata about stealth sessions activated by the agent."""

        return dict(self._stealth_sessions)

    @property
    def last_display_message(self) -> Optional[str]:
        """Return the last message provided to :meth:`display`."""

        return self._last_display

    # ------------------------------------------------------------------
    # Core behaviours
    # ------------------------------------------------------------------
    def configure_resonance_monitor(
        self,
        *,
        gradient_windows: bool = True,
        technique_breakdown: bool = True,
    ) -> Dict[str, object]:
        """Derive the active resonance monitor configuration."""

        digest = self._access_layer.pilot_visibility_digest()
        configuration: Dict[str, object] = {}
        if gradient_windows:
            configuration["gradient_window_seconds"] = digest.get("gradient_window_seconds")
            configuration["resonance_gradient"] = digest.get("resonance_gradient")
        if technique_breakdown:
            configuration["technique_breakdown"] = digest.get("technique_breakdown", {})
        self._resonance_configuration = configuration
        return configuration

    def launch(self, *, mode: str = "pre-release", sync_with_devday_tools: bool = True) -> AgentLaunchState:
        """Activate the agent, returning the launch state summary."""

        widget_state: Dict[str, Dict[str, object]] = {}
        for widget in self.config.widgets:
            widget_state[widget.name] = {
                "description": widget.description,
                "config": dict(widget.config),
                "active": True,
            }
        self._widget_state = widget_state

        commitments = self._mission_control.refresh_commitments()
        resonance_digest = self._access_layer.pilot_visibility_digest()
        resonance_config = self.configure_resonance_monitor()

        return AgentLaunchState(
            mode=mode,
            sync_with_devday_tools=sync_with_devday_tools,
            resonance_digest=resonance_digest,
            resonance_configuration=resonance_config,
            mission_commitments=commitments,
            codex_integrity=self.config.codex_integrity,
            tools=self.config.tools,
            widgets=widget_state,
        )

    def display(self, message: str) -> str:
        """Persist a status message for downstream dashboards."""

        self._last_display = message
        return message

    # ------------------------------------------------------------------
    # Agentic workflows
    # ------------------------------------------------------------------
    def onboard_contributor(
        self,
        partner_id: str,
        *,
        api_keys: Iterable[str],
        wallet_addresses: Iterable[str],
        metadata: Optional[MutableMapping[str, object]] = None,
        watermark: bool = False,
    ) -> Dict[str, object]:
        """Register a contributor and issue a protocol key for onboarding."""

        record = self._access_layer.register_partner(
            partner_id,
            api_keys=api_keys,
            wallet_addresses=wallet_addresses,
            default_watermark=watermark,
            metadata=metadata,
        )
        protocol_key = self._access_layer.issue_protocol_key(
            partner_id,
            metadata={"source": "GhostkeyVaultfireAgent"},
        )
        return {"partner": record, "protocol_key": protocol_key}

    def verify_trust(
        self,
        partner_id: str,
        *,
        protocol_key: str,
        api_key: Optional[str] = None,
        wallet_address: Optional[str] = None,
        wallet_signature: Optional[str] = None,
        protocols: Optional[Iterable[str]] = None,
        simulate_real_user_load: bool = False,
        load_multiplier: float = 1.0,
    ) -> PilotSession:
        """Activate a pilot session, returning the session handle."""

        session = self._access_layer.activate_session(
            partner_id,
            protocol_key=protocol_key,
            api_key=api_key,
            wallet_address=wallet_address,
            wallet_signature=wallet_signature,
            protocols=protocols,
            simulate_real_user_load=simulate_real_user_load,
            load_multiplier=load_multiplier,
        )
        self._active_sessions[session.session_id] = session
        return session

    def enable_stealth_pilot(
        self,
        session: PilotSession,
        *,
        allow_confidential_sessions: bool = True,
        grant_corporate_protocols_like_ASM_private_access: bool = True,
        auto_expire_on_signal_mismatch: bool = True,
    ) -> Dict[str, object]:
        """Enable stealth mode for ``session`` and log Mission Control telemetry."""

        settings = {
            "allow_confidential_sessions": bool(allow_confidential_sessions),
            "grant_corporate_protocols_like_ASM_private_access": bool(
                grant_corporate_protocols_like_ASM_private_access
            ),
            "auto_expire_on_signal_mismatch": bool(auto_expire_on_signal_mismatch),
        }
        mission_record = self._mcp.log_resonance(
            partner_tag=session.partner_tag,
            session_id=session.session_id,
        )
        digest = session.resonance_digest() or mission_record["digest"]
        self._stealth_sessions[session.session_id] = {
            "partner_tag": session.partner_tag,
            "settings": settings,
            "resonance_digest": digest,
        }
        return {
            "session_id": session.session_id,
            "stealth": settings,
            "mission_control": mission_record,
            "resonance_digest": digest,
        }

