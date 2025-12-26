"""Circuit breaker pattern for external service calls.

Prevents cascading failures by temporarily rejecting calls to failing services.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitState(Enum):
    """Circuit breaker states following the standard pattern."""

    CLOSED = "closed"  # Normal operation, requests pass through
    OPEN = "open"  # Failure threshold exceeded, reject all requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is OPEN and rejects a call."""

    pass


class CircuitBreaker:
    """Circuit breaker implementation for protecting external service calls.

    The circuit breaker has three states:
    - CLOSED: Normal operation, all calls proceed
    - OPEN: Service unavailable, all calls rejected
    - HALF_OPEN: Testing recovery, limited calls allowed

    Transitions:
    - CLOSED → OPEN: After failure_threshold consecutive failures
    - OPEN → HALF_OPEN: After recovery_timeout seconds
    - HALF_OPEN → CLOSED: On first successful call
    - HALF_OPEN → OPEN: On any failure
    """

    def __init__(
        self,
        *,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: type[Exception] | tuple[type[Exception], ...] = Exception,
        name: str = "circuit_breaker",
    ) -> None:
        """Initialize circuit breaker.

        Args:
            failure_threshold: Number of consecutive failures before opening
            recovery_timeout: Seconds to wait before attempting recovery
            expected_exception: Exception types to count as failures
            name: Name for logging and metrics
        """
        self.failure_threshold = max(1, failure_threshold)
        self.recovery_timeout = max(1.0, recovery_timeout)
        self.expected_exception = expected_exception
        self.name = name

        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: datetime | None = None
        self.state = CircuitState.CLOSED

        # Metrics
        self.metrics = {
            "calls_succeeded": 0,
            "calls_failed": 0,
            "calls_rejected": 0,
            "state_transitions": 0,
            "total_failures": 0,
            "total_successes": 0,
        }

    def call(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """Execute function with circuit breaker protection.

        Args:
            func: Function to call
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func

        Returns:
            Result from func

        Raises:
            CircuitBreakerOpenError: If circuit is OPEN
            Exception: Any exception raised by func
        """
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self._transition_to_half_open()
            else:
                self.metrics["calls_rejected"] += 1
                time_since_failure = (
                    (datetime.utcnow() - self.last_failure_time).total_seconds()
                    if self.last_failure_time
                    else 0
                )
                remaining = max(0, self.recovery_timeout - time_since_failure)
                raise CircuitBreakerOpenError(
                    f"Circuit breaker '{self.name}' is OPEN. "
                    f"Service unavailable. Retry in {remaining:.1f}s"
                )

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as exc:
            self._on_failure()
            raise

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt recovery."""
        if not self.last_failure_time:
            return False
        elapsed = (datetime.utcnow() - self.last_failure_time).total_seconds()
        return elapsed >= self.recovery_timeout

    def _on_success(self) -> None:
        """Handle successful call."""
        self.metrics["calls_succeeded"] += 1
        self.metrics["total_successes"] += 1
        self.success_count += 1
        self.failure_count = 0

        if self.state == CircuitState.HALF_OPEN:
            logger.info(f"Circuit breaker '{self.name}' recovered, transitioning to CLOSED")
            self._transition_to_closed()

    def _on_failure(self) -> None:
        """Handle failed call."""
        self.metrics["calls_failed"] += 1
        self.metrics["total_failures"] += 1
        self.failure_count += 1
        self.success_count = 0
        self.last_failure_time = datetime.utcnow()

        if self.state == CircuitState.HALF_OPEN:
            logger.warning(
                f"Circuit breaker '{self.name}' failed in HALF_OPEN, reopening circuit"
            )
            self._transition_to_open()
        elif self.failure_count >= self.failure_threshold:
            logger.error(
                f"Circuit breaker '{self.name}' opening after "
                f"{self.failure_count} consecutive failures"
            )
            self._transition_to_open()

    def _transition_to_open(self) -> None:
        """Transition to OPEN state."""
        if self.state != CircuitState.OPEN:
            self.state = CircuitState.OPEN
            self.metrics["state_transitions"] += 1

    def _transition_to_half_open(self) -> None:
        """Transition to HALF_OPEN state."""
        logger.info(f"Circuit breaker '{self.name}' attempting recovery (HALF_OPEN)")
        self.state = CircuitState.HALF_OPEN
        self.metrics["state_transitions"] += 1

    def _transition_to_closed(self) -> None:
        """Transition to CLOSED state."""
        self.state = CircuitState.CLOSED
        self.metrics["state_transitions"] += 1
        self.failure_count = 0

    def reset(self) -> None:
        """Manually reset circuit breaker to CLOSED state."""
        logger.info(f"Circuit breaker '{self.name}' manually reset to CLOSED")
        self._transition_to_closed()

    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed (normal operation)."""
        return self.state == CircuitState.CLOSED

    @property
    def is_open(self) -> bool:
        """Check if circuit is open (rejecting calls)."""
        return self.state == CircuitState.OPEN

    @property
    def is_half_open(self) -> bool:
        """Check if circuit is half-open (testing recovery)."""
        return self.state == CircuitState.HALF_OPEN

    @property
    def state_value(self) -> int:
        """Get numeric state value for metrics (0=closed, 1=open, 2=half_open)."""
        return {
            CircuitState.CLOSED: 0,
            CircuitState.OPEN: 1,
            CircuitState.HALF_OPEN: 2,
        }[self.state]


__all__ = ["CircuitBreaker", "CircuitBreakerOpenError", "CircuitState"]
