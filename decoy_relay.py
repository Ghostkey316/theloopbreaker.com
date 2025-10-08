"""Decoy relay routing through Ghostkey-316 lineage."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import List, Sequence

from cloak_pulse import CloakPulse
from shadowbridge import ShadowBridge
from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID


@dataclass(frozen=True)
class DecoyRoute:
    """Represents a routed decoy identity."""

    ghost_identity: str
    route: str
    intensity: float
    timestamp: datetime
    wallet_origin: str
    pulse_signature: str


class DecoyRelay:
    """Routes traffic through actor-led ghost identities."""

    def __init__(
        self,
        *,
        ghost_identities: Sequence[str] | None = None,
        shadow_bridge: ShadowBridge | None = None,
        cloak_pulse: CloakPulse | None = None,
        lineage: str = ORIGIN_NODE_ID,
        wallet_origin: str = ARCHITECT_WALLET,
        debug: bool = False,
    ) -> None:
        self.wallet_origin = wallet_origin
        self.lineage = lineage
        self.ghost_identities = list(
            ghost_identities
            or (
                f"{lineage}::echo",
                f"{lineage}::prism",
                f"{lineage}::ember",
                f"{lineage}::veil",
            )
        )
        self.shadow_bridge = shadow_bridge or ShadowBridge()
        self._pulse = cloak_pulse or CloakPulse(lineage=lineage)
        self._debug = debug
        self._history: List[DecoyRoute] = []

    @property
    def debug(self) -> bool:
        return self._debug

    def set_debug(self, enabled: bool) -> None:
        self._debug = enabled
        self._pulse.set_debug(enabled)
        if not enabled:
            self._history.clear()

    def relay(
        self,
        event: str,
        *,
        intensity: float = 0.5,
        consented: bool = True,
    ) -> DecoyRoute:
        """Route the provided event through a decoy identity."""

        if not consented:
            raise PermissionError("decoy relay respects opt-in consent only")
        if not 0 <= intensity <= 1:
            raise ValueError("intensity must be between 0 and 1")
        pulse = self._pulse.emit(context=f"{event}:{intensity}")
        index = self._select_index(pulse)
        ghost_identity = self.ghost_identities[index % len(self.ghost_identities)]
        route = self.shadow_bridge.route_override(ghost_identity)
        record = DecoyRoute(
            ghost_identity=ghost_identity,
            route=route,
            intensity=float(intensity),
            timestamp=pulse.timestamp,
            wallet_origin=self.wallet_origin,
            pulse_signature=pulse.signature,
        )
        if self._debug:
            self._history.append(record)
        return record

    def audit_trail(self) -> Sequence[DecoyRoute]:
        """Return recorded decoy routes when debug mode is active."""

        return tuple(self._history)

    def _select_index(self, pulse) -> int:
        noise_vector = pulse.noise_vector
        return max(range(len(noise_vector)), key=lambda idx: noise_vector[idx])


__all__ = ["DecoyRelay", "DecoyRoute"]
