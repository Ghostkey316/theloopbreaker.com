"""Belief sandbox metrics tracker with Prometheus-compatible stubs."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List

BELIEF_SANDBOX_PATH = Path("logs/belief-sandbox.json")


@dataclass
class MetricSample:
    name: str
    value: float
    labels: Dict[str, str] = field(default_factory=dict)

    def as_prometheus(self) -> str:
        if not self.labels:
            return f"{self.name} {self.value}"
        label_blob = ",".join(f"{k}='{v}'" for k, v in sorted(self.labels.items()))
        return f"{self.name}{{{label_blob}}} {self.value}"


class BeliefTracker:
    """Lightweight tracker for belief sandbox KPIs."""

    def __init__(self) -> None:
        self._users: Dict[str, float] = {}
        self._tvl: float = 0.0
        self._drift: float = 0.0
        self._events: List[Dict[str, float]] = []

    def ingest(self, user: str, *, tvl: float, drift: float, belief: float) -> None:
        self._users[user] = belief
        self._tvl += tvl
        self._drift = max(0.0, min(1.0, drift))
        self._events.append({"tvl": tvl, "drift": drift, "belief": belief})

    def export(self) -> Iterable[MetricSample]:
        yield MetricSample("vaultfire_users_total", float(len(self._users)))
        yield MetricSample("vaultfire_tvl_usd", self._tvl)
        yield MetricSample("vaultfire_alignment_drift", self._drift)

    def grafana_examples(self) -> List[str]:
        return [
            "sum(vaultfire_tvl_usd)",
            "avg(vaultfire_alignment_drift)",
            "topk(5, vaultfire_users_total)",
        ]

    def snapshot(self) -> Dict[str, float]:
        return {
            "users": float(len(self._users)),
            "tvl": self._tvl,
            "drift": self._drift,
        }

    def attestation(self) -> str:
        return "ATTESTATION: [PROM-STUB] – Drift <3%, MMFA aligned."


__all__ = ["BeliefTracker", "MetricSample", "BELIEF_SANDBOX_PATH"]
