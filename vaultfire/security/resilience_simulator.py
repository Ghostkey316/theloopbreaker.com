"""Resilience simulator for Vaultfire mission audits.

The simulator stress-tests partner modules under extreme conditions by
simulating more than a million active wallets, randomized loyalty events,
placeholder encrypted staking operations, and concurrent pilot programs.
It also records replay logs and metrics that help auditors verify
consistency across runs.
"""

from __future__ import annotations

import hashlib
import math
import random
import threading
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Callable, Dict, Iterable, Iterator, List, Mapping, MutableMapping, Optional, Sequence

SimulationHandler = Callable[["SimulationEvent"], None]


@dataclass(frozen=True)
class ResilienceScenario:
    """Configuration parameters for the resilience simulator.

    Attributes
    ----------
    wallet_count:
        Total number of wallets to simulate. Defaults to 1.2 million to
        reflect production scale.
    loyalty_event_rate:
        Average rate of loyalty events per wallet. Values between 0 and 1
        represent the percentage of wallets expected to trigger a loyalty
        signal on each iteration.
    staking_batch_size:
        Number of wallets processed in each staking batch. This controls
        how many encrypted staking payloads are generated at a time.
    pilot_iterations:
        Number of complete passes across the wallet population for each
        pilot run.
    replay_window:
        Maximum number of historical events retained per pilot for replay.
        The simulator retains the most recent events up to this limit.
    seed:
        Optional seed that ensures reproducible simulations. When provided
        the underlying pseudo-random generators are deterministic across
        runs and replays.
    """

    wallet_count: int = 1_200_000
    loyalty_event_rate: float = 0.05
    staking_batch_size: int = 10_000
    pilot_iterations: int = 3
    replay_window: int = 100_000
    seed: Optional[int] = None

    def __post_init__(self) -> None:  # pragma: no cover - defensive type checking
        if self.wallet_count <= 0:
            raise ValueError("wallet_count must be positive")
        if not 0 <= self.loyalty_event_rate <= 1:
            raise ValueError("loyalty_event_rate must be between 0 and 1")
        if self.staking_batch_size <= 0:
            raise ValueError("staking_batch_size must be positive")
        if self.pilot_iterations <= 0:
            raise ValueError("pilot_iterations must be positive")
        if self.replay_window <= 0:
            raise ValueError("replay_window must be positive")


@dataclass
class SimulationEvent:
    """Single event generated during a pilot run."""

    pilot: str
    wallet_id: int
    event_type: str
    loyalty_delta: float
    staking_ciphertext: str
    timestamp: float
    metadata: Mapping[str, float] = field(default_factory=dict)


@dataclass
class PilotRunResult:
    """Aggregated output and metrics from a pilot run."""

    pilot: str
    events: List[SimulationEvent]
    failures: List[str]
    metrics: Mapping[str, float]

    def performance_summary(self) -> Mapping[str, float]:
        """Return the subset of metrics relevant for audit summaries."""

        summary_keys = (
            "duration_seconds",
            "events_processed",
            "failures",
            "throughput_events_per_second",
            "unique_wallets",
            "average_loyalty_delta",
        )
        return {key: self.metrics[key] for key in summary_keys if key in self.metrics}


@dataclass
class PilotConfig:
    """Configuration for a single pilot run."""

    name: str
    handler: SimulationHandler
    iterations: Optional[int] = None


class ResilienceSimulator:
    """Stress test Vaultfire modules under load with replay support."""

    def __init__(self, scenario: Optional[ResilienceScenario] = None) -> None:
        self._scenario = scenario or ResilienceScenario()
        if self._scenario.seed is not None:
            random.seed(self._scenario.seed)
        self._lock = threading.RLock()
        self._replay_logs: MutableMapping[str, List[SimulationEvent]] = defaultdict(list)
        self._metrics_cache: MutableMapping[str, Mapping[str, float]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def run(
        self,
        pilots: Sequence[PilotConfig],
        concurrency: int = 4,
    ) -> Mapping[str, PilotRunResult]:
        """Execute a sequence of pilots concurrently.

        Parameters
        ----------
        pilots:
            Collection of :class:`PilotConfig` instances describing the
            modules to stress test.
        concurrency:
            Maximum number of concurrent pilot runs. Uses a thread pool to
            spread load across pilots while keeping CPU usage predictable.
        """

        if not pilots:
            return {}
        results: MutableMapping[str, PilotRunResult] = {}

        # Local import to avoid mandatory dependency when the simulator is unused.
        from concurrent.futures import ThreadPoolExecutor, as_completed

        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as executor:
            future_to_pilot = {
                executor.submit(self._execute_pilot, pilot): pilot.name for pilot in pilots
            }
            for future in as_completed(future_to_pilot):
                pilot_name = future_to_pilot[future]
                try:
                    results[pilot_name] = future.result()
                except Exception as exc:  # pragma: no cover - defensive logging path
                    results[pilot_name] = PilotRunResult(
                        pilot=pilot_name,
                        events=[],
                        failures=[f"pilot-error:{exc!r}"],
                        metrics={"duration_seconds": 0.0, "events_processed": 0, "failures": 1},
                    )
        return dict(results)

    def replay(self, pilot_name: str, handler: Optional[SimulationHandler] = None) -> PilotRunResult:
        """Replay the latest events for ``pilot_name``.

        Parameters
        ----------
        pilot_name:
            Identifier of the pilot to replay.
        handler:
            Optional handler to execute during replay. When omitted the
            handler associated with the original run is reused.
        """

        with self._lock:
            events = list(self._replay_logs.get(pilot_name, []))
            metrics = self._metrics_cache.get(pilot_name, {})
            original_handler = getattr(self, "_pilot_handlers", {}).get(pilot_name)

        active_handler = handler or original_handler
        if active_handler is None:
            raise ValueError(f"No handler available for pilot {pilot_name!r}")

        failures: List[str] = []
        start = time.perf_counter()
        for event in events:
            try:
                active_handler(event)
            except Exception as exc:  # pragma: no cover - defensive replay path
                failures.append(f"replay-error:{exc!r}")
        duration = time.perf_counter() - start
        replay_metrics = dict(metrics)
        replay_metrics.update(
            {
                "replay_duration_seconds": duration,
                "replay_failures": len(failures),
            }
        )
        return PilotRunResult(pilot=pilot_name, events=events, failures=failures, metrics=replay_metrics)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _execute_pilot(self, pilot: PilotConfig) -> PilotRunResult:
        scenario = self._scenario
        handler = pilot.handler
        if not callable(handler):
            raise TypeError("Pilot handler must be callable")

        iterations = pilot.iterations or scenario.pilot_iterations
        total_events: List[SimulationEvent] = []
        failures: List[str] = []
        wallet_counter: Counter[int] = Counter()

        start = time.perf_counter()
        for iteration in range(iterations):
            for batch_index, batch in enumerate(self._wallet_batches()):
                events = list(self._generate_events(pilot.name, batch, iteration, batch_index))
                for event in events:
                    try:
                        handler(event)
                    except Exception as exc:
                        failures.append(self._format_failure(event, exc))
                    else:
                        wallet_counter[event.wallet_id] += 1
                total_events.extend(events)
        duration = time.perf_counter() - start

        metrics = self._build_metrics(
            pilot=pilot.name,
            duration=duration,
            events=total_events,
            failures=failures,
            wallet_counter=wallet_counter,
        )
        trimmed_events = self._trim_for_replay(total_events)
        with self._lock:
            self._replay_logs[pilot.name] = trimmed_events
            self._metrics_cache[pilot.name] = metrics
            self._pilot_handlers = getattr(self, "_pilot_handlers", {})
            self._pilot_handlers[pilot.name] = handler
        return PilotRunResult(pilot=pilot.name, events=trimmed_events, failures=failures, metrics=metrics)

    def _wallet_batches(self) -> Iterable[Sequence[int]]:
        scenario = self._scenario
        batch_size = scenario.staking_batch_size
        wallet_count = scenario.wallet_count
        if wallet_count <= batch_size:
            yield tuple(range(wallet_count))
            return
        batches = math.ceil(wallet_count / batch_size)
        for batch_index in range(batches):
            start = batch_index * batch_size
            end = min(wallet_count, start + batch_size)
            yield tuple(range(start, end))

    def _generate_events(
        self,
        pilot_name: str,
        batch: Sequence[int],
        iteration: int,
        batch_index: int,
    ) -> Iterator[SimulationEvent]:
        scenario = self._scenario
        event_target = max(1, int(len(batch) * scenario.loyalty_event_rate))
        wallets = random.sample(batch, k=min(len(batch), event_target))
        timestamp = time.time()
        for wallet_id in wallets:
            loyalty_delta = random.uniform(-5.0, 10.0)
            staking_ciphertext = self._encrypt_staking_payload(wallet_id, timestamp, iteration)
            metadata = {
                "iteration": float(iteration),
                "batch_index": float(batch_index),
            }
            yield SimulationEvent(
                pilot=pilot_name,
                wallet_id=wallet_id,
                event_type=random.choice(["loyalty", "staking", "redemption"]),
                loyalty_delta=loyalty_delta,
                staking_ciphertext=staking_ciphertext,
                timestamp=timestamp,
                metadata=metadata,
            )

    def _encrypt_staking_payload(self, wallet_id: int, timestamp: float, iteration: int) -> str:
        payload = f"wallet:{wallet_id}|ts:{timestamp:.6f}|iter:{iteration}|seed:{self._scenario.seed}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _format_failure(self, event: SimulationEvent, exc: Exception) -> str:
        return (
            f"{event.pilot}:{event.wallet_id}:{event.event_type}:"
            f"{exc.__class__.__name__}:{exc}"  # noqa: B306 - str(exc) is intentional
        )

    def _build_metrics(
        self,
        pilot: str,
        duration: float,
        events: Sequence[SimulationEvent],
        failures: Sequence[str],
        wallet_counter: Mapping[int, int],
    ) -> Mapping[str, float]:
        events_processed = float(len(events))
        failures_count = float(len(failures))
        throughput = events_processed / duration if duration else 0.0
        loyalty_values = [event.loyalty_delta for event in events]
        average_loyalty = sum(loyalty_values) / events_processed if events_processed else 0.0
        unique_wallets = float(len(wallet_counter))
        loyalty_variance = 0.0
        if events_processed:
            loyalty_variance = sum(
                (event.loyalty_delta - average_loyalty) ** 2 for event in events
            ) / events_processed
        metrics: Dict[str, float] = {
            "pilot": float(hash(pilot) & 0xFFFFFFFF),
            "duration_seconds": duration,
            "events_processed": events_processed,
            "failures": failures_count,
            "throughput_events_per_second": throughput,
            "unique_wallets": unique_wallets,
            "average_loyalty_delta": average_loyalty,
            "loyalty_variance": loyalty_variance,
        }
        return metrics

    def _trim_for_replay(self, events: Sequence[SimulationEvent]) -> List[SimulationEvent]:
        replay_window = self._scenario.replay_window
        if len(events) <= replay_window:
            return list(events)
        return list(events[-replay_window:])


__all__ = [
    "ResilienceScenario",
    "SimulationEvent",
    "PilotRunResult",
    "PilotConfig",
    "ResilienceSimulator",
]
