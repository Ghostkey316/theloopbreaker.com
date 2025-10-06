"""Convenience wrappers around Mission Control hooks for Agent Builder."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Optional

from vaultfire.enterprise.mission_control import EnterpriseMissionControl
from vaultfire_widget_bundle.telemetry.mission_hooks import MissionControlHooks

from .access_layer import PilotAccessLayer
from .privacy import PilotPrivacyLedger
from .resonance import PilotResonanceTelemetry
from .session import PilotSession

__all__ = ["MissionControlHookBundle", "setup"]


@dataclass
class MissionControlHookBundle:
    """Bundle binding Mission Control hooks to the current access layer."""

    hooks: MissionControlHooks
    mission_control: EnterpriseMissionControl

    def rebind(
        self,
        access_layer: PilotAccessLayer,
        *,
        mission_control: Optional[EnterpriseMissionControl] = None,
    ) -> None:
        """Rebind hooks to ``access_layer`` while preserving Mission Control."""

        control = mission_control or self.mission_control
        self.hooks = MissionControlHooks(
            ledger=access_layer.ledger,
            telemetry=access_layer.resonance,
            mission_control=control,
        )
        self.mission_control = control

    def on_session_launch(
        self,
        session: PilotSession,
        *,
        partner_profile: Optional[Mapping[str, object]] = None,
    ) -> Mapping[str, object]:
        return self.hooks.on_session_launch(session, partner_profile=partner_profile)

    def on_stealth_activation(
        self,
        session: PilotSession,
        *,
        allow_confidential_sessions: bool,
        auto_expire_on_signal_mismatch: bool,
        metadata: Optional[Mapping[str, object]] = None,
    ):
        return self.hooks.on_stealth_activation(
            session,
            allow_confidential_sessions=allow_confidential_sessions,
            auto_expire_on_signal_mismatch=auto_expire_on_signal_mismatch,
            metadata=metadata,
        )

    def on_gradient_packet(
        self,
        session: PilotSession,
        packet,
        *,
        store_payload: bool = False,
    ):
        return self.hooks.on_gradient_packet(session, packet, store_payload=store_payload)


def setup(
    *,
    access_layer: Optional[PilotAccessLayer] = None,
    mission_control: Optional[EnterpriseMissionControl] = None,
) -> MissionControlHookBundle:
    """Initialise a :class:`MissionControlHookBundle`."""

    if access_layer is None:
        ledger = PilotPrivacyLedger()
        telemetry = PilotResonanceTelemetry(ledger=ledger)
        control = mission_control or EnterpriseMissionControl()
        hooks = MissionControlHooks(ledger=ledger, telemetry=telemetry, mission_control=control)
        return MissionControlHookBundle(hooks=hooks, mission_control=control)

    control = mission_control or EnterpriseMissionControl()
    hooks = MissionControlHooks(
        ledger=access_layer.ledger,
        telemetry=access_layer.resonance,
        mission_control=control,
    )
    return MissionControlHookBundle(hooks=hooks, mission_control=control)

