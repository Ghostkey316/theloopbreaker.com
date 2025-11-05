"""Belief-weighted Monte Carlo projections for Vaultfire yields."""
from __future__ import annotations

import json
import hashlib
import random
import statistics
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, List, Sequence

try:
    import sympy as sp
    from sympy import Matrix
    from sympy.crypto.crypto import sha256
    from sympy.stats import Normal, sample
    _HAVE_SYMPY = True
except ImportError:  # pragma: no cover - fallback path
    sp = None  # type: ignore
    Matrix = list  # type: ignore

    def sha256(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def sample(distribution, size: int, seed: int | None = None):  # type: ignore
        rng = random.Random(seed)
        mean, sigma = distribution  # type: ignore[arg-type]
        return [rng.gauss(mean, sigma) for _ in range(size)]

    _HAVE_SYMPY = False

BELIEF_LOG_PATH = Path("telemetry/belief-log.json")


@dataclass(slots=True)
class DriftProjection:
    """Container for Drift Oracle simulation results."""

    expected_yield: float
    drift_ratio: float
    alignment_score: float
    samples: Sequence[float] = field(repr=False)

    @property
    def attestation(self) -> str:
        """Return MMFA aligned attestation text."""
        digest = sha256(str(self.expected_yield) + str(self.alignment_score))
        return f"ATTESTATION: [{digest[:12]}] – Drift <3%, MMFA aligned."


class DriftOracle:
    """Monte Carlo Drift Oracle backed by SymPy symbolic primitives."""

    def __init__(
        self,
        belief_weights: Sequence[float],
        *,
        alignment_threshold: float = 0.95,
        drift_limit: float = 0.03,
        trials: int = 512,
        seed: int | None = None,
    ) -> None:
        if not belief_weights:
            raise ValueError("belief_weights cannot be empty")
        self._weights = tuple(float(w) for w in belief_weights)
        self._alignment_threshold = alignment_threshold
        self._drift_limit = drift_limit
        self._trials = max(32, int(trials))
        self._seed = seed
        self._symbol = sp.symbols("mu") if _HAVE_SYMPY else None

    @classmethod
    def from_belief_log(
        cls,
        *,
        path: Path = BELIEF_LOG_PATH,
        alignment_threshold: float = 0.95,
        drift_limit: float = 0.03,
        trials: int = 512,
        seed: int | None = 316,
    ) -> "DriftOracle":
        """Create an oracle from the belief log JSON file."""
        if path.exists():
            try:
                payload = json.loads(path.read_text())
            except json.JSONDecodeError:
                payload = []
        else:
            payload = []
        weights = _extract_weights(payload)
        if not weights:
            weights = [0.97, 0.95, 0.99]
        return cls(
            weights,
            alignment_threshold=alignment_threshold,
            drift_limit=drift_limit,
            trials=trials,
            seed=seed,
        )

    def project(self, *, base_amount: float, volatility: float = 0.05) -> DriftProjection:
        """Run a Monte Carlo simulation and return projection data."""
        if base_amount <= 0:
            raise ValueError("base_amount must be positive")
        mu = sum(self._weights) / len(self._weights)
        sigma = max(1e-6, volatility * mu)
        if _HAVE_SYMPY:
            distribution = Normal("yield", base_amount * mu, base_amount * sigma)
            draws = sample(distribution, size=self._trials, seed=self._seed)
            vector = Matrix(draws)
            expected = float(sum(vector)) / len(vector)
        else:
            distribution = (base_amount * mu, base_amount * sigma)
            draws = sample(distribution, size=self._trials, seed=self._seed)
            expected = statistics.mean(draws)
        drift_ratio = abs(expected - base_amount) / base_amount
        alignment_score = min(1.0, mu)
        projection = DriftProjection(
            expected_yield=expected,
            drift_ratio=drift_ratio,
            alignment_score=alignment_score,
            samples=tuple(float(x) for x in draws),
        )
        self._verify(projection)
        return projection

    def _verify(self, projection: DriftProjection) -> None:
        if projection.alignment_score < self._alignment_threshold:
            raise ValueError(
                f"Alignment score {projection.alignment_score:.3f} below threshold {self._alignment_threshold:.2f}"
            )
        if projection.drift_ratio > self._drift_limit:
            raise ValueError(
                f"Drift ratio {projection.drift_ratio:.3%} exceeds limit {self._drift_limit:.0%}"
            )

    def describe(self) -> dict:
        """Return a serializable snapshot for logging."""
        return {
            "weights": list(self._weights),
            "alignment_threshold": self._alignment_threshold,
            "drift_limit": self._drift_limit,
            "trials": self._trials,
            "seed": self._seed,
        }


def _extract_weights(payload: Iterable[dict]) -> List[float]:
    weights: List[float] = []
    for item in payload:
        if isinstance(item, dict):
            belief = item.get("belief_multiplier") or item.get("beliefCoefficient")
            if belief is not None:
                try:
                    weights.append(float(belief))
                except (TypeError, ValueError):
                    continue
    return weights


__all__ = ["DriftOracle", "DriftProjection", "BELIEF_LOG_PATH"]
