"""Prometheus metrics exporter for Vaultfire protocol.

Exposes protocol metrics in Prometheus format for monitoring and alerting.
"""
from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Iterator

try:
    from prometheus_client import Counter, Gauge, Histogram, Info
    from prometheus_client import REGISTRY, generate_latest

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False


class MetricsExporter:
    """Export Vaultfire protocol metrics to Prometheus."""

    def __init__(self) -> None:
        if not PROMETHEUS_AVAILABLE:
            raise ImportError(
                "prometheus_client not installed. "
                "Install with: pip install prometheus-client"
            )

        # BeliefSync metrics
        self.belief_syncs_total = Counter(
            "vaultfire_belief_syncs_total",
            "Total belief syncs attempted",
            ["status"],  # succeeded, failed, rejected
        )

        self.belief_sync_duration = Histogram(
            "vaultfire_belief_sync_duration_seconds",
            "Time spent syncing beliefs to NS3",
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
        )

        self.replay_attacks_blocked = Counter(
            "vaultfire_replay_attacks_blocked_total",
            "Total replay attacks blocked by nonce validation",
        )

        self.belief_sync_retries = Counter(
            "vaultfire_belief_sync_retries_total", "Total retry attempts for NS3 syncs"
        )

        # PoPEngine metrics
        self.pop_scores_calculated = Counter(
            "vaultfire_pop_scores_total", "Total PoP scores calculated"
        )

        self.pop_upgrades_triggered = Counter(
            "vaultfire_pop_upgrades_total",
            "Total PoP tier upgrades",
            ["from_tier", "to_tier"],
        )

        self.pop_cache_operations = Counter(
            "vaultfire_cache_operations_total",
            "Total cache operations",
            ["operation"],  # read, write
        )

        self.pop_listener_failures = Counter(
            "vaultfire_listener_failures_total",
            "Total upgrade listener failures",
        )

        # VaultdripRouter metrics
        self.drip_routes_total = Counter(
            "vaultfire_drip_routes_total",
            "Total drip routing attempts",
            ["status"],  # routed, rejected, ineligible
        )

        self.drip_bonuses_flagged = Counter(
            "vaultfire_drip_bonuses_flagged_total",
            "Total high-loyalty bonuses flagged",
        )

        # Circuit breaker metrics
        self.circuit_breaker_state = Gauge(
            "vaultfire_circuit_breaker_state",
            "Circuit breaker state (0=closed, 1=open, 2=half_open)",
            ["service"],
        )

        self.circuit_breaker_calls = Counter(
            "vaultfire_circuit_breaker_calls_total",
            "Total circuit breaker calls",
            ["service", "result"],  # succeeded, failed, rejected
        )

        self.circuit_breaker_transitions = Counter(
            "vaultfire_circuit_breaker_transitions_total",
            "Total circuit breaker state transitions",
            ["service", "from_state", "to_state"],
        )

        # LoyaltyEngine metrics
        self.loyalty_multipliers_calculated = Counter(
            "vaultfire_loyalty_multipliers_total",
            "Total loyalty multipliers calculated",
        )

        self.loyalty_yield_class = Counter(
            "vaultfire_loyalty_yield_class_total",
            "Total validators by yield class",
            ["yield_class"],  # Bronze, Silver, Gold, Sovereign
        )

        # System info
        self.protocol_info = Info(
            "vaultfire_protocol",
            "Vaultfire protocol version and build info",
        )
        self.protocol_info.info(
            {
                "version": "1.1",
                "protocol": "vaultfire",
                "mission": "belief-secured-intelligence",
            }
        )

    # BeliefSync recording
    def record_sync(self, status: str, duration: float | None = None) -> None:
        """Record a belief sync attempt."""
        self.belief_syncs_total.labels(status=status).inc()
        if duration is not None:
            self.belief_sync_duration.observe(duration)

    @contextmanager
    def time_sync(self) -> Iterator[None]:
        """Context manager to time a sync operation."""
        start = time.time()
        try:
            yield
            duration = time.time() - start
            self.record_sync("succeeded", duration)
        except Exception:
            duration = time.time() - start
            self.record_sync("failed", duration)
            raise

    def record_replay_attack(self) -> None:
        """Record a blocked replay attack."""
        self.replay_attacks_blocked.inc()

    def record_sync_retry(self) -> None:
        """Record a sync retry attempt."""
        self.belief_sync_retries.inc()

    # PoPEngine recording
    def record_score_calculation(self) -> None:
        """Record a PoP score calculation."""
        self.pop_scores_calculated.inc()

    def record_upgrade(self, from_tier: int, to_tier: int) -> None:
        """Record a PoP tier upgrade."""
        self.pop_upgrades_triggered.labels(
            from_tier=str(from_tier), to_tier=str(to_tier)
        ).inc()

    def record_cache_operation(self, operation: str) -> None:
        """Record a cache operation (read or write)."""
        self.pop_cache_operations.labels(operation=operation).inc()

    def record_listener_failure(self) -> None:
        """Record an upgrade listener failure."""
        self.pop_listener_failures.inc()

    # VaultdripRouter recording
    def record_drip_route(self, status: str) -> None:
        """Record a drip routing attempt."""
        self.drip_routes_total.labels(status=status).inc()

    def record_bonus_flagged(self) -> None:
        """Record a high-loyalty bonus flag."""
        self.drip_bonuses_flagged.inc()

    # Circuit breaker recording
    def update_circuit_breaker_state(self, service: str, state: int) -> None:
        """Update circuit breaker state gauge."""
        self.circuit_breaker_state.labels(service=service).set(state)

    def record_circuit_breaker_call(self, service: str, result: str) -> None:
        """Record a circuit breaker call."""
        self.circuit_breaker_calls.labels(service=service, result=result).inc()

    def record_circuit_breaker_transition(
        self, service: str, from_state: str, to_state: str
    ) -> None:
        """Record a circuit breaker state transition."""
        self.circuit_breaker_transitions.labels(
            service=service, from_state=from_state, to_state=to_state
        ).inc()

    # LoyaltyEngine recording
    def record_multiplier_calculation(self) -> None:
        """Record a loyalty multiplier calculation."""
        self.loyalty_multipliers_calculated.inc()

    def record_yield_class(self, yield_class: str) -> None:
        """Record a validator's yield class."""
        self.loyalty_yield_class.labels(yield_class=yield_class).inc()

    # Export
    def get_metrics(self) -> bytes:
        """Return Prometheus-formatted metrics."""
        return generate_latest(REGISTRY)


# Singleton instance
_exporter_instance: MetricsExporter | None = None


def get_metrics_exporter() -> MetricsExporter:
    """Get or create the global metrics exporter instance."""
    global _exporter_instance
    if _exporter_instance is None:
        _exporter_instance = MetricsExporter()
    return _exporter_instance


__all__ = ["MetricsExporter", "get_metrics_exporter", "PROMETHEUS_AVAILABLE"]
