"""Unified consent relay graph chaining Vaultfire cloaking modules."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Mapping, MutableMapping, Sequence

from cloak_pulse import CloakPulse
from decoy_relay import DecoyRelay, DecoyRoute
from mirrorlock_core import MirrorlockCore, BehaviorToken
from persona_drift import PersonaDrift, PersonaProfile
from signal_scrambler import ScrambledSignal, SignalScrambler
from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID
from vaultfire.protocol.mission_covenant import (
    MissionCovenant,
    MissionCovenantLedger,
)


@dataclass(frozen=True)
class RelayResult:
    """Represents a unified relay output."""

    partner_id: str
    covenant_id: str
    token: BehaviorToken
    persona: PersonaProfile
    scrambled_signal: ScrambledSignal
    decoy_route: DecoyRoute
    audit_reference: str
    timestamp: datetime


class ConsentRelayGraph:
    """Chains cloaking modules ensuring consent-first routing."""

    def __init__(
        self,
        *,
        mission_ledger: MissionCovenantLedger | None = None,
        cloak_pulse: CloakPulse | None = None,
        debug: bool = False,
    ) -> None:
        self.cloak_pulse = cloak_pulse or CloakPulse(lineage=ORIGIN_NODE_ID)
        self.mission_ledger = mission_ledger or MissionCovenantLedger()
        self.persona_drift = PersonaDrift(
            base_wallet=ARCHITECT_WALLET,
            override_identity=ORIGIN_NODE_ID,
            cloak_pulse=self.cloak_pulse,
            debug=debug,
        )
        self.decoy_relay = DecoyRelay(
            cloak_pulse=self.cloak_pulse,
            lineage=ORIGIN_NODE_ID,
            wallet_origin=ARCHITECT_WALLET,
            debug=debug,
        )
        self.signal_scrambler = SignalScrambler(
            cloak_pulse=self.cloak_pulse,
            wallet_origin=ARCHITECT_WALLET,
            debug=debug,
        )
        self.mirrorlock = MirrorlockCore(
            base_identity=ARCHITECT_WALLET,
            override_identity=ORIGIN_NODE_ID,
            deception_layer=self.persona_drift.deception_layer,
            shadow_bridge=self.decoy_relay.shadow_bridge,
        )
        self._debug = debug
        self._consent_map: MutableMapping[str, MissionCovenant] = {}
        self._audit_log: MutableMapping[str, RelayResult] = {}

    @property
    def debug(self) -> bool:
        return self._debug

    def set_debug(self, enabled: bool) -> None:
        self._debug = enabled
        self.cloak_pulse.set_debug(enabled)
        self.persona_drift.set_debug(enabled)
        self.decoy_relay.set_debug(enabled)
        self.signal_scrambler.set_debug(enabled)
        if not enabled:
            self._audit_log.clear()

    def register_covenant(self, covenant: MissionCovenant) -> None:
        """Register a covenant ensuring it is valid."""

        if not self.mission_ledger.verify_covenant(covenant):
            raise ValueError("covenant failed unstoppable hash verification")
        self._consent_map[covenant.partner_id] = covenant

    def route_signal(
        self,
        partner_id: str,
        module: str,
        action: str,
        *,
        metadata: Mapping[str, object] | None = None,
        persona_traits: Mapping[str, object] | None = None,
    ) -> RelayResult:
        """Route a module action through the consent graph."""

        covenant = self._consent_map.get(partner_id)
        if covenant is None:
            raise PermissionError(f"partner {partner_id} has not provided consent")
        token = self.mirrorlock.observe(module, action, metadata=dict(metadata or {}))
        persona = self.persona_drift.shift(
            module,
            persona_traits,
            consented=True,
        )
        scrambled = self.signal_scrambler.scramble([token], route_hint=module)[0]
        decoy = self.decoy_relay.relay(action, consented=True)
        audit_reference = f"{covenant.covenant_id}:{token.token_id}"
        result = RelayResult(
            partner_id=partner_id,
            covenant_id=covenant.covenant_id,
            token=token,
            persona=persona,
            scrambled_signal=scrambled,
            decoy_route=decoy,
            audit_reference=audit_reference,
            timestamp=datetime.utcnow(),
        )
        if self._debug:
            self._audit_log[audit_reference] = result
        return result

    def consented_partners(self) -> Sequence[str]:
        """Return the list of partners that have provided covenants."""

        return tuple(sorted(self._consent_map.keys()))

    def audit_trail(self) -> Dict[str, RelayResult]:
        """Return the captured relay results when debug is enabled."""

        return {key: value for key, value in self._audit_log.items()}


__all__ = ["ConsentRelayGraph", "RelayResult"]
