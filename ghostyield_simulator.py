"""$GHOSTYIELD simulator for low seven-figure loyalty flow modelling."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, MutableMapping


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_EXPORT_PATH = BASE_DIR / "telemetry" / "ghostyield_simulation.json"
LOW_SEVEN_FIGURE_RANGE = (1_000_000, 4_999_999)


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


@dataclass(slots=True)
class GhostYieldScenario:
    """Single simulation result returned by ``GhostYieldSimulator``."""

    wallet_count: int
    belief_multiplier: float
    loyalty_multiplier: float
    projected_yield: float
    currency: str = "$GHOSTYIELD"

    def as_dict(self) -> MutableMapping[str, float | int | str]:
        return {
            "wallet_count": self.wallet_count,
            "belief_multiplier": round(self.belief_multiplier, 4),
            "loyalty_multiplier": round(self.loyalty_multiplier, 4),
            "projected_yield": round(self.projected_yield, 2),
            "currency": self.currency,
        }


@dataclass
class GhostYieldSimulator:
    """Model early loyalty flows for mission-aligned pilot programs."""

    base_loyalty_multiplier: float = 1.08
    sandbox_carryover: float = 0.97
    volatility_buffer: float = 0.05
    currency: str = "$GHOSTYIELD"
    export_path: Path = DEFAULT_EXPORT_PATH
    scenarios: list[GhostYieldScenario] = field(default_factory=list, init=False)

    def _effective_multiplier(self, belief_multiplier: float) -> float:
        return max(0.85, belief_multiplier * self.base_loyalty_multiplier * self.sandbox_carryover)

    def project(self, wallet_count: int, belief_multiplier: float, *, average_reward: float = 4.2) -> GhostYieldScenario:
        loyalty_multiplier = self._effective_multiplier(belief_multiplier)
        projected = wallet_count * average_reward * loyalty_multiplier
        projected = _clamp(projected, *LOW_SEVEN_FIGURE_RANGE)
        scenario = GhostYieldScenario(
            wallet_count=wallet_count,
            belief_multiplier=belief_multiplier,
            loyalty_multiplier=loyalty_multiplier,
            projected_yield=projected,
            currency=self.currency,
        )
        self.scenarios.append(scenario)
        return scenario

    def simulate(self, wallet_segments: Iterable[tuple[int, float]], *, average_reward: float = 4.2) -> list[GhostYieldScenario]:
        results: list[GhostYieldScenario] = []
        for wallet_count, belief_multiplier in wallet_segments:
            results.append(self.project(wallet_count, belief_multiplier, average_reward=average_reward))
        return results

    def export(self) -> Path:
        payload = {
            "currency": self.currency,
            "range": {
                "min": LOW_SEVEN_FIGURE_RANGE[0],
                "max": LOW_SEVEN_FIGURE_RANGE[1],
            },
            "scenarios": [scenario.as_dict() for scenario in self.scenarios],
            "metadata": {
                "base_loyalty_multiplier": self.base_loyalty_multiplier,
                "sandbox_carryover": self.sandbox_carryover,
                "volatility_buffer": self.volatility_buffer,
            },
        }
        self.export_path.parent.mkdir(parents=True, exist_ok=True)
        with self.export_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
        return self.export_path


__all__ = ["GhostYieldSimulator", "GhostYieldScenario", "LOW_SEVEN_FIGURE_RANGE"]

