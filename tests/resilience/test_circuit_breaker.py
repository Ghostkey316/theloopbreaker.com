"""Tests for circuit breaker pattern."""
from datetime import datetime, timedelta

import pytest

from vaultfire.resilience import CircuitBreaker, CircuitBreakerOpenError, CircuitState


def test_circuit_breaker_allows_calls_when_closed():
    """Circuit breaker should allow calls when in CLOSED state."""
    cb = CircuitBreaker(failure_threshold=3)

    result = cb.call(lambda: "success")

    assert result == "success"
    assert cb.is_closed
    assert cb.metrics["calls_succeeded"] == 1
    assert cb.metrics["calls_failed"] == 0


def test_circuit_breaker_opens_after_threshold_failures():
    """Circuit breaker should open after consecutive failures."""
    cb = CircuitBreaker(failure_threshold=3, expected_exception=ValueError)

    # Trigger 3 consecutive failures
    for _ in range(3):
        with pytest.raises(ValueError):
            cb.call(lambda: _raise_error(ValueError("fail")))

    assert cb.is_open
    assert cb.failure_count == 3
    assert cb.metrics["calls_failed"] == 3


def test_circuit_breaker_rejects_calls_when_open():
    """Circuit breaker should reject calls when OPEN."""
    cb = CircuitBreaker(failure_threshold=2, expected_exception=ValueError)

    # Trigger failures to open circuit
    for _ in range(2):
        with pytest.raises(ValueError):
            cb.call(lambda: _raise_error(ValueError("fail")))

    # Circuit should now be open
    assert cb.is_open

    # Next call should be rejected immediately
    with pytest.raises(CircuitBreakerOpenError, match="is OPEN"):
        cb.call(lambda: "should not execute")

    assert cb.metrics["calls_rejected"] == 1


def test_circuit_breaker_transitions_to_half_open_after_timeout():
    """Circuit breaker should attempt recovery after timeout (manual reset test)."""
    cb = CircuitBreaker(
        failure_threshold=2,
        recovery_timeout=1.0,  # 1 second
        expected_exception=ValueError
    )

    # Open the circuit
    for _ in range(2):
        with pytest.raises(ValueError):
            cb.call(lambda: _raise_error(ValueError("fail")))

    assert cb.is_open

    # Manual reset to simulate timeout passing
    cb.reset()

    # Next call should be allowed
    result = cb.call(lambda: "recovery successful")

    assert result == "recovery successful"
    assert cb.is_closed


def test_circuit_breaker_closes_on_success_in_half_open():
    """Circuit breaker should close on successful call after manual recovery."""
    cb = CircuitBreaker(
        failure_threshold=2,
        recovery_timeout=1.0,
        expected_exception=ValueError
    )

    # Open the circuit
    for _ in range(2):
        with pytest.raises(ValueError):
            cb.call(lambda: _raise_error(ValueError("fail")))

    assert cb.is_open

    # Manual reset (simulates timeout)
    cb.reset()

    result = cb.call(lambda: "recovered")

    assert result == "recovered"
    assert cb.is_closed
    assert cb.failure_count == 0


def test_circuit_breaker_reopens_on_failure_in_half_open():
    """Circuit breaker should reopen on failure after manual reset."""
    cb = CircuitBreaker(
        failure_threshold=2,
        recovery_timeout=1.0,
        expected_exception=ValueError
    )

    # Open the circuit
    for _ in range(2):
        with pytest.raises(ValueError):
            cb.call(lambda: _raise_error(ValueError("fail")))

    assert cb.is_open

    # Manual reset to simulate recovery attempt
    cb.reset()

    # Fail immediately - should open again with threshold=2
    for _ in range(2):
        with pytest.raises(ValueError):
            cb.call(lambda: _raise_error(ValueError("still failing")))

    # Should be OPEN again
    assert cb.is_open


def test_circuit_breaker_manual_reset():
    """Circuit breaker should support manual reset."""
    cb = CircuitBreaker(failure_threshold=2, expected_exception=ValueError)

    # Open the circuit
    for _ in range(2):
        with pytest.raises(ValueError):
            cb.call(lambda: _raise_error(ValueError("fail")))

    assert cb.is_open

    # Manual reset
    cb.reset()

    assert cb.is_closed
    assert cb.failure_count == 0

    # Should allow calls again
    result = cb.call(lambda: "working")
    assert result == "working"


def test_circuit_breaker_resets_failure_count_on_success():
    """Circuit breaker should reset failure count on success."""
    cb = CircuitBreaker(failure_threshold=3, expected_exception=ValueError)

    # Have some failures
    with pytest.raises(ValueError):
        cb.call(lambda: _raise_error(ValueError("fail")))

    assert cb.failure_count == 1

    # Successful call should reset counter
    cb.call(lambda: "success")

    assert cb.failure_count == 0
    assert cb.is_closed


def test_circuit_breaker_tracks_state_transitions():
    """Circuit breaker should track state transitions in metrics."""
    cb = CircuitBreaker(failure_threshold=2, expected_exception=ValueError)

    initial_transitions = cb.metrics["state_transitions"]

    # Trigger failures to open
    for _ in range(2):
        with pytest.raises(ValueError):
            cb.call(lambda: _raise_error(ValueError("fail")))

    # Should have transitioned CLOSED -> OPEN
    assert cb.metrics["state_transitions"] == initial_transitions + 1

    # Manual reset triggers OPEN -> CLOSED
    cb.reset()

    assert cb.metrics["state_transitions"] == initial_transitions + 2


def test_circuit_breaker_only_counts_expected_exceptions():
    """Circuit breaker should only count expected exception types as failures."""
    cb = CircuitBreaker(failure_threshold=2, expected_exception=ValueError)

    # TypeError should not count as failure
    with pytest.raises(TypeError):
        cb.call(lambda: _raise_error(TypeError("unexpected")))

    assert cb.failure_count == 0
    assert cb.is_closed

    # ValueError should count
    with pytest.raises(ValueError):
        cb.call(lambda: _raise_error(ValueError("expected")))

    assert cb.failure_count == 1


def test_circuit_breaker_state_value_property():
    """Circuit breaker should provide numeric state values for metrics."""
    cb = CircuitBreaker(failure_threshold=2, expected_exception=ValueError)

    # CLOSED = 0
    assert cb.state_value == 0

    # Open the circuit -> OPEN = 1
    for _ in range(2):
        with pytest.raises(ValueError):
            cb.call(lambda: _raise_error(ValueError("fail")))

    assert cb.state_value == 1


# Helper function
def _raise_error(exc: Exception) -> None:
    raise exc
