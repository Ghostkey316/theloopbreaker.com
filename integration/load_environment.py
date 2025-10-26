"""Enterprise integration environment simulations."""
from __future__ import annotations

import asyncio
import random
import statistics
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List


@dataclass
class LoadSimulationConfig:
    """Configuration for the load simulation harness."""

    concurrent_users: int = 10_000
    ramp_up_seconds: int = 60
    duration_seconds: int = 180
    network_label: str = "base-testnet"
    target_endpoints: List[str] = field(
        default_factory=lambda: [
            "/api/v2/belief/signal",
            "/api/v2/loyalty/activate",
            "/api/v2/purpose/pulse",
        ]
    )
    output_dir: Path = Path("integration/artifacts")


@dataclass
class LoadSample:
    """Individual sample captured during the load test."""

    timestamp: str
    endpoint: str
    latency_ms: float
    status_code: int
    synthetic_user: str


class EnterpriseIntegrationEnvironment:
    """Simulates sustained load against the enterprise API surface."""

    def __init__(self, config: LoadSimulationConfig) -> None:
        self.config = config
        self.samples: List[LoadSample] = []
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        self._rng = random.Random(316)

    async def simulate(self) -> Dict[str, object]:
        """Run the synthetic load harness."""

        semaphore = asyncio.Semaphore(250)
        tasks = [
            asyncio.create_task(self._simulate_user(user_id, semaphore))
            for user_id in range(self.config.concurrent_users)
        ]
        await asyncio.gather(*tasks)
        return self._summarise()

    async def _simulate_user(self, user_id: int, semaphore: asyncio.Semaphore) -> None:
        async with semaphore:
            await asyncio.sleep(self._rng.uniform(0, self.config.ramp_up_seconds) / self.config.ramp_up_seconds)
            endpoint = self._rng.choice(self.config.target_endpoints)
            latency_ms = max(35.0, self._rng.gauss(120, 25))
            status_code = 200 if self._rng.random() > 0.01 else 500
            sample = LoadSample(
                timestamp=datetime.utcnow().isoformat(timespec="seconds") + "Z",
                endpoint=endpoint,
                latency_ms=round(latency_ms, 2),
                status_code=status_code,
                synthetic_user=f"ghost-sim-{user_id}",
            )
            self.samples.append(sample)
            await asyncio.sleep(max(0.0, self.config.duration_seconds / self.config.concurrent_users))

    def _summarise(self) -> Dict[str, object]:
        latencies = [sample.latency_ms for sample in self.samples]
        status_codes = [sample.status_code for sample in self.samples]
        throughput = len(self.samples) / max(1, self.config.duration_seconds)
        summary = {
            "timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "network": self.config.network_label,
            "identity_tag": "ghostkey-316",
            "total_requests": len(self.samples),
            "avg_latency_ms": round(statistics.mean(latencies), 2) if latencies else 0.0,
            "p95_latency_ms": round(self._percentile(latencies, 95), 2) if latencies else 0.0,
            "error_rate": round(status_codes.count(500) / len(status_codes), 4) if status_codes else 0.0,
            "throughput_rps": round(throughput, 2),
        }
        output_path = self.config.output_dir / "load_summary.json"
        output_path.write_text(json_dumps(summary), encoding="utf-8")
        return summary

    @staticmethod
    def _percentile(values: Iterable[float], percentile: float) -> float:
        if not values:
            return 0.0
        ordered = sorted(values)
        k = (len(ordered) - 1) * (percentile / 100)
        f = int(k)
        c = min(f + 1, len(ordered) - 1)
        if f == c:
            return ordered[int(k)]
        return ordered[f] + (ordered[c] - ordered[f]) * (k - f)


def json_dumps(payload: Dict[str, object]) -> str:
    import json

    return json.dumps(payload, indent=2)


__all__ = ["EnterpriseIntegrationEnvironment", "LoadSimulationConfig", "LoadSample"]
