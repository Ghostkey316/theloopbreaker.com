"""Persona drift engine layering ShadowFrost with CloakPulse."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import hashlib
from typing import Dict, Mapping, MutableMapping, Sequence

from cloak_pulse import CloakPulse
from deception_net import ShadowFrostDeceptionLayer
from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID


def _derive_wallet_hex(wallet_id: str) -> str:
    digest = hashlib.sha3_256(wallet_id.encode("utf-8")).hexdigest()
    return f"0x{digest[:40]}"


@dataclass(frozen=True)
class PersonaProfile:
    """Represents a dynamically shifted persona."""

    app: str
    wallet_origin: str
    wallet_address: str
    traits: Dict[str, object]
    override_route: str
    session_signature: str
    timestamp: datetime
    lineage: str
    consented: bool


class PersonaDrift:
    """Persona mimicry helper riding on top of ShadowFrost."""

    def __init__(
        self,
        *,
        base_wallet: str = ARCHITECT_WALLET,
        override_identity: str = ORIGIN_NODE_ID,
        deception_layer: ShadowFrostDeceptionLayer | None = None,
        cloak_pulse: CloakPulse | None = None,
        debug: bool = False,
    ) -> None:
        self.wallet_origin = base_wallet
        self.override_identity = override_identity
        self._base_wallet_hex = _derive_wallet_hex(base_wallet)
        self.deception_layer = deception_layer or ShadowFrostDeceptionLayer(
            override_identity=override_identity
        )
        self._pulse = cloak_pulse or CloakPulse(lineage=override_identity)
        self._debug = debug
        self._history: MutableMapping[str, Sequence[PersonaProfile]] = {}

    @property
    def debug(self) -> bool:
        return self._debug

    def set_debug(self, enabled: bool) -> None:
        self._debug = enabled
        self._pulse.set_debug(enabled)
        if not enabled:
            self._history.clear()

    def shift(
        self,
        app: str,
        traits: Mapping[str, object] | None = None,
        *,
        consented: bool = True,
    ) -> PersonaProfile:
        """Return a persona profile for the requested app."""

        if not consented:
            raise PermissionError("persona drift cannot spoof unwilling behavior")
        pulse = self._pulse.emit(context=app)
        mutated_wallet = self.deception_layer.mutate_address(
            self._base_wallet_hex, app, seed=pulse.entropy_hex
        )
        handshake = self.deception_layer.negotiate_quantum_fallback(app)
        normalized_traits: Dict[str, object] = dict(traits or {})
        normalized_traits.setdefault("behavioral_vector", list(pulse.noise_vector))
        normalized_traits.setdefault("heartbeat", pulse.heartbeat)
        normalized_traits.setdefault("wallet_lineage", self.wallet_origin)
        profile = PersonaProfile(
            app=app,
            wallet_origin=self.wallet_origin,
            wallet_address=mutated_wallet,
            traits=normalized_traits,
            override_route=handshake.override_route,
            session_signature=pulse.signature,
            timestamp=pulse.timestamp,
            lineage=self.override_identity,
            consented=consented,
        )
        if self._debug:
            history = list(self._history.get(app, ()))
            history.append(profile)
            self._history[app] = tuple(history)
        return profile

    def audit_trail(self) -> Dict[str, Sequence[PersonaProfile]]:
        """Return recorded persona profiles when debug capture is active."""

        return {key: tuple(value) for key, value in self._history.items()}


__all__ = ["PersonaDrift", "PersonaProfile"]
