"""Governance veto failover stub for Vaultfire safe-mode."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict


@dataclass
class FailoverSignal:
    drift_ratio: float
    adversarial_percentage: float

    def is_critical(self, *, threshold: float = 0.1) -> bool:
        return self.adversarial_percentage >= threshold or self.drift_ratio >= 0.05


class ManifestFailover:
    """Python port of the manifest failover guard."""

    def __init__(
        self,
        *,
        veto_callback: Callable[[Dict[str, float]], None],
        threshold: float = 0.1,
    ) -> None:
        self._veto_callback = veto_callback
        self._threshold = threshold

    def evaluate(self, signal: FailoverSignal) -> Dict[str, float]:
        payload = {
            "drift_ratio": signal.drift_ratio,
            "adversarial_percentage": signal.adversarial_percentage,
        }
        if signal.is_critical(threshold=self._threshold):
            self._veto_callback(payload)
            payload["status"] = "paused"
        else:
            payload["status"] = "clear"
        return payload


def create_failover(*, threshold: float = 0.1) -> ManifestFailover:
    log: Dict[str, Dict[str, float]] = {}

    def veto(payload: Dict[str, float]) -> None:
        log["last_veto"] = payload

    guard = ManifestFailover(veto_callback=veto, threshold=threshold)

    def evaluate(adversarial: float, drift: float) -> Dict[str, float]:
        signal = FailoverSignal(drift_ratio=drift, adversarial_percentage=adversarial)
        result = guard.evaluate(signal)
        if result["status"] == "paused":
            result["event"] = "manifest.failover.veto"
        return result

    guard.evaluate_signal = evaluate  # type: ignore[attr-defined]
    guard.veto_log = log  # type: ignore[attr-defined]
    return guard


__all__ = ["ManifestFailover", "FailoverSignal", "create_failover"]
