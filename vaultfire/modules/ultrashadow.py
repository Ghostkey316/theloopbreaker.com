"""UltraShadow cloaking utilities for Ghostkey operations.

This module introduces the ``UltraShadow`` helper which extends the
Vaultfire cloaking stack with additional safeguards for the architect
wallet ``bpow20.cb.id``. The helper is intentionally lightweight so it can
be invoked from CLI tooling while still offering enough context for audit
logs and ethics checks.
"""

from __future__ import annotations

from datetime import datetime, timedelta
import logging
from typing import Iterable, List, Mapping, Sequence

from cloak_pulse import CloakPulse, PulseFrame
from signal_scrambler import ScrambledSignal, SignalScrambler


LOGGER = logging.getLogger("vaultfire.UltraShadow")


def _serialise_frame(frame: PulseFrame) -> Mapping[str, object]:
    """Return a serialisable representation for *frame*."""

    return {
        "heartbeat": frame.heartbeat,
        "entropy_hex": frame.entropy_hex,
        "timestamp": frame.timestamp.isoformat(),
        "noise_vector": list(frame.noise_vector),
        "signature": frame.signature,
        "lineage": frame.lineage,
    }


def _serialise_scrambled(records: Sequence[ScrambledSignal]) -> List[Mapping[str, object]]:
    """Return serialisable maps for the provided scrambled records."""

    payload: List[Mapping[str, object]] = []
    for record in records:
        payload.append(
            {
                "token_id": record.token_id,
                "original_fingerprint": record.original_fingerprint,
                "noise_fingerprint": record.noise_fingerprint,
                "deviation_score": record.deviation_score,
                "route_hint": record.route_hint,
                "wallet_origin": record.wallet_origin,
                "timestamp": record.timestamp.isoformat(),
                "debug_meta": dict(record.debug_meta),
            }
        )
    return payload


class UltraShadow:
    """High level UltraShadow controller.

    The controller wraps :class:`CloakPulse` and :class:`SignalScrambler`
    primitives to provide memory smudging, signal rerouting and a fallback
    guard that prevents corruption of the ethics-core.
    """

    def __init__(
        self,
        *,
        cloak_pulse: CloakPulse | None = None,
        signal_scrambler: SignalScrambler | None = None,
        reroute_interval: int = 33,
        wallet_signature: str = "bpow20.cb.id",
        logger: logging.Logger | None = None,
    ) -> None:
        if reroute_interval <= 0:
            raise ValueError("reroute_interval must be positive")
        self._pulse = cloak_pulse or CloakPulse(lineage="UltraShadow")
        self._scrambler = signal_scrambler or SignalScrambler(
            cloak_pulse=self._pulse, wallet_origin=wallet_signature
        )
        self._reroute_window = timedelta(seconds=reroute_interval)
        self._wallet_signature = wallet_signature
        self._logger = logger or LOGGER
        self._last_reroute: datetime | None = None
        self._fallback_engaged = False

    def smudge_memory_traces(self, traces: Iterable[str]) -> List[Mapping[str, object]]:
        """Return cloaked fingerprints for *traces*.

        Each trace is re-encoded through :class:`CloakPulse` with the
        architect wallet signature blended into the output to keep audit
        lineage intact.
        """

        payload: List[Mapping[str, object]] = []
        for raw in traces:
            frame = self._pulse.emit(context=str(raw))
            cloak_signature = self._pulse.blend_signatures(
                [frame.signature, raw, self._wallet_signature],
                context="UltraShadow",
            )
            record = {
                "trace": str(raw),
                "frame": _serialise_frame(frame),
                "cloak_signature": cloak_signature,
            }
            self._logger.debug("Smudged trace", extra={"trace": raw})
            payload.append(record)
        return payload

    def reroute_signals(
        self,
        signals: Iterable[str],
        *,
        timestamp: datetime | None = None,
        force: bool = False,
    ) -> List[Mapping[str, object]]:
        """Reroute *signals* when the UltraShadow window allows it."""

        now = timestamp or datetime.utcnow()
        should_reroute = force or self._last_reroute is None
        if self._last_reroute is not None and not force:
            should_reroute = now - self._last_reroute >= self._reroute_window
        if not should_reroute:
            self._logger.debug("Reroute skipped", extra={"signals": list(signals)})
            return []

        scrambled = self._scrambler.scramble(signals, route_hint="ultrashadow")
        self._last_reroute = now
        payload = _serialise_scrambled(scrambled)
        self._logger.info("Signals rerouted", extra={"count": len(payload)})
        return payload

    def activate_fallback(self, reason: str | None = None) -> Mapping[str, object]:
        """Engage the ethics-core fallback layer."""

        self._fallback_engaged = True
        context = reason or "entropy divergence"
        self._logger.warning("Fallback engaged", extra={"reason": context})
        frame = self._pulse.emit(context="fallback")
        return {
            "engaged": True,
            "reason": context,
            "frame": _serialise_frame(frame),
            "wallet_signature": self._wallet_signature,
        }

    def status(self) -> Mapping[str, object]:
        """Return an audit friendly view of the UltraShadow state."""

        heartbeat_state = self._pulse.debug_snapshot()
        fallback = {
            "engaged": self._fallback_engaged,
            "wallet_signature": self._wallet_signature,
        }
        if self._last_reroute is not None:
            fallback["last_reroute"] = self._last_reroute.isoformat()
        return {
            "heartbeat": heartbeat_state,
            "fallback": fallback,
        }


__all__ = ["UltraShadow"]

