"""Signal scrambler injecting deterministic AI-visible noise."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, List, Sequence

from cloak_pulse import CloakPulse
from mirrorlock_core import BehaviorToken
from vaultfire.protocol.constants import ARCHITECT_WALLET


@dataclass(frozen=True)
class ScrambledSignal:
    """Represents a scrambled behavior fingerprint."""

    token_id: str
    original_fingerprint: str
    noise_fingerprint: str
    deviation_score: float
    route_hint: str
    wallet_origin: str
    timestamp: datetime
    debug_meta: dict


class SignalScrambler:
    """Injects cloaking noise into outbound wallet behavior patterns."""

    def __init__(
        self,
        *,
        cloak_pulse: CloakPulse | None = None,
        noise_floor: float = 0.35,
        wallet_origin: str = ARCHITECT_WALLET,
        debug: bool = False,
    ) -> None:
        self._pulse = cloak_pulse or CloakPulse()
        self.noise_floor = float(noise_floor)
        self.wallet_origin = wallet_origin
        self._debug = debug
        self._history: List[ScrambledSignal] = []

    @property
    def debug(self) -> bool:
        return self._debug

    def set_debug(self, enabled: bool) -> None:
        self._debug = enabled
        self._pulse.set_debug(enabled)
        if not enabled:
            self._history.clear()

    def scramble(
        self,
        tokens: Iterable[BehaviorToken | str],
        *,
        route_hint: str = "wallet",
    ) -> Sequence[ScrambledSignal]:
        """Return scrambled representations for the provided tokens."""

        scrambled: List[ScrambledSignal] = []
        for raw in tokens:
            token, fingerprint = self._normalise_token(raw)
            pulse = self._pulse.emit(context=fingerprint)
            noise = self._pulse.blend_signatures(
                [fingerprint, pulse.signature, route_hint], context=self.wallet_origin
            )
            deviation = self._compute_deviation(pulse)
            record = ScrambledSignal(
                token_id=token,
                original_fingerprint=fingerprint,
                noise_fingerprint=noise,
                deviation_score=deviation,
                route_hint=route_hint,
                wallet_origin=self.wallet_origin,
                timestamp=pulse.timestamp,
                debug_meta={
                    "heartbeat": pulse.heartbeat,
                    "noise_vector": list(pulse.noise_vector),
                },
            )
            if self._debug:
                self._history.append(record)
            scrambled.append(record)
        return tuple(scrambled)

    def audit_trail(self) -> Sequence[ScrambledSignal]:
        """Return the captured scrambled signals when debug mode is active."""

        return tuple(self._history)

    def _normalise_token(self, raw: BehaviorToken | str) -> tuple[str, str]:
        if isinstance(raw, BehaviorToken):
            return raw.token_id, raw.behavior_fingerprint
        fingerprint = str(raw)
        token_id = f"scramble::{fingerprint[:12]}"
        return token_id, fingerprint

    def _compute_deviation(self, pulse) -> float:
        noise_vector = pulse.noise_vector
        uniform = 1.0 / len(noise_vector)
        deviation = sum(abs(value - uniform) for value in noise_vector)
        return max(self.noise_floor, deviation)


__all__ = ["SignalScrambler", "ScrambledSignal"]
