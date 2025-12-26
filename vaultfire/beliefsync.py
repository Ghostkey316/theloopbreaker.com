"""NS3 BeliefSync integration layer."""
from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Mapping, MutableMapping

import httpx

from utils.belief_signer import BeliefSigner
from vaultfire.resilience import CircuitBreaker, CircuitBreakerOpenError

try:
    from vaultfire.observability import get_metrics_exporter, PROMETHEUS_AVAILABLE
except ImportError:
    PROMETHEUS_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class BeliefSyncResult:
    """Result returned by :meth:`BeliefSync.push_to_ns3`."""

    payload: Mapping[str, Any]
    envelope: Mapping[str, Any]
    response: Mapping[str, Any] | None
    receipt_valid: bool


class BeliefSync:
    """Translate vaultloop snapshots into NS3-compatible belief payloads."""

    def __init__(
        self,
        signer: BeliefSigner,
        *,
        ns3_endpoint: str = "https://ns3.local/sync/beliefs",
        clock: Callable[[], datetime] | None = None,
        max_retries: int = 3,
        retry_backoff_base: float = 2.0,
        enable_circuit_breaker: bool = True,
    ) -> None:
        self.signer = signer
        self.ns3_endpoint = ns3_endpoint
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self.last_payload: Mapping[str, Any] | None = None
        self._nonce_counter: int = 0
        self._used_nonces: set[str] = set()
        self.max_retries = max(1, max_retries)
        self.retry_backoff_base = max(1.0, retry_backoff_base)

        # Circuit breaker for NS3 endpoint
        self._circuit_breaker: CircuitBreaker | None = None
        if enable_circuit_breaker:
            self._circuit_breaker = CircuitBreaker(
                failure_threshold=5,
                recovery_timeout=30.0,
                expected_exception=(httpx.HTTPError, httpx.TimeoutException),
                name="ns3_sync",
            )

        # Prometheus metrics exporter
        self._metrics_exporter = None
        if PROMETHEUS_AVAILABLE:
            try:
                self._metrics_exporter = get_metrics_exporter()
            except Exception as exc:
                logger.warning(f"Failed to initialize Prometheus exporter: {exc}")

        # Internal metrics tracking
        self.metrics = {
            "syncs_attempted": 0,
            "syncs_succeeded": 0,
            "syncs_failed": 0,
            "retries_total": 0,
            "replays_blocked": 0,
            "circuit_breaker_rejections": 0,
        }

    def _generate_nonce(self) -> str:
        """Generate a unique nonce for replay attack prevention."""
        self._nonce_counter += 1
        timestamp_ns = int(self._clock().timestamp() * 1e9)
        return f"{timestamp_ns}-{self._nonce_counter}"

    def _perform_sync(self, envelope: Mapping[str, Any]) -> Mapping[str, Any] | None:
        """Perform HTTP POST to NS3 endpoint.

        This method is wrapped by the circuit breaker for resilience.
        """
        resp = httpx.post(self.ns3_endpoint, json=envelope, timeout=10)
        resp.raise_for_status()
        try:
            return resp.json()
        except ValueError:
            return None

    def sync_from_vaultloop(self, snapshot: Mapping[str, Any]) -> MutableMapping[str, Any]:
        """Convert a vaultloop snapshot into an NS3 belief payload."""

        if not isinstance(snapshot, Mapping):
            raise TypeError("vaultloop snapshot must be a mapping")

        now = self._clock()

        validator_id = snapshot.get("validator_id")
        if not validator_id:
            raise ValueError("snapshot missing validator_id")

        belief_hash = snapshot.get("belief_hash") or self._hash_snapshot(snapshot)
        pop_score = self._extract_pop_score(snapshot)
        amplifier_strength = self._extract_amplifier_strength(snapshot)
        drip_delta = self._calculate_drip_delta(snapshot, now)
        loop_recall_vector = self._build_loop_recall_vector(snapshot)
        nonce = self._generate_nonce()

        payload: MutableMapping[str, Any] = {
            "validator_id": validator_id,
            "belief_hash": belief_hash,
            "PoP_score": pop_score,
            "amplifier_strength": amplifier_strength,
            "timestamp": now.isoformat(),
            "drip_delta": drip_delta,
            "loop_recall_vector": loop_recall_vector,
            "nonce": nonce,
        }

        self.last_payload = payload
        return payload

    def push_to_ns3(self, payload: Mapping[str, Any]) -> BeliefSyncResult:
        """Sign and forward a payload to the NS3 endpoint with retry logic."""

        self._validate_payload(payload)
        self.metrics["syncs_attempted"] += 1

        # Check for replay attacks
        nonce = payload.get("nonce")
        if nonce and nonce in self._used_nonces:
            self.metrics["replays_blocked"] += 1
            if self._metrics_exporter:
                self._metrics_exporter.record_replay_attack()
            logger.warning(f"Replay attack blocked: nonce {nonce} already used")
            raise ValueError(f"Replay attack detected: nonce {nonce} already used")

        timestamp = self._clock()
        signature = self.signer.sign(payload, timestamp=timestamp)
        if not self.signer.verify(payload, signature, timestamp=timestamp, tolerance_windows=0):
            raise ValueError("payload failed tamper verification before dispatch")

        envelope = {
            "payload": payload,
            "signature": signature,
            "timestamp": timestamp.isoformat(),
        }

        # Wrap HTTP call with circuit breaker if enabled
        start_time = time.time()

        # Retry logic with exponential backoff
        last_exception = None
        for attempt in range(self.max_retries):
            try:
                # Use circuit breaker if available
                if self._circuit_breaker:
                    try:
                        response_json = self._circuit_breaker.call(
                            self._perform_sync, envelope
                        )
                    except CircuitBreakerOpenError:
                        self.metrics["circuit_breaker_rejections"] += 1
                        logger.warning("NS3 sync rejected: circuit breaker OPEN")
                        raise
                else:
                    response_json = self._perform_sync(envelope)

                receipt_valid = False
                receipt = None
                if isinstance(response_json, Mapping):
                    receipt = response_json.get("receipt")
                    if receipt:
                        receipt_valid = self.validate_receipt(receipt)

                # Success - mark nonce as used
                if nonce:
                    self._used_nonces.add(nonce)
                    # Prune old nonces (keep last 10000)
                    if len(self._used_nonces) > 10000:
                        to_remove = len(self._used_nonces) - 10000
                        for _ in range(to_remove):
                            self._used_nonces.pop()

                self.metrics["syncs_succeeded"] += 1
                duration = time.time() - start_time

                # Record Prometheus metrics
                if self._metrics_exporter:
                    self._metrics_exporter.record_sync("succeeded", duration)
                    if self._circuit_breaker:
                        self._metrics_exporter.update_circuit_breaker_state(
                            "ns3_sync", self._circuit_breaker.state_value
                        )

                logger.info(
                    f"NS3 sync succeeded for validator {payload.get('validator_id')} "
                    f"in {duration:.2f}s"
                )

                return BeliefSyncResult(
                    payload=payload, envelope=envelope, response=response_json, receipt_valid=receipt_valid
                )

            except CircuitBreakerOpenError:
                # Circuit breaker open, don't retry
                raise
            except (httpx.HTTPError, httpx.TimeoutException) as exc:
                last_exception = exc
                if attempt < self.max_retries - 1:
                    self.metrics["retries_total"] += 1
                    if self._metrics_exporter:
                        self._metrics_exporter.record_sync_retry()
                    backoff = self.retry_backoff_base ** attempt
                    logger.warning(
                        f"NS3 sync attempt {attempt + 1}/{self.max_retries} failed: {exc}. "
                        f"Retrying in {backoff}s..."
                    )
                    time.sleep(backoff)
                else:
                    logger.error(f"NS3 sync failed after {self.max_retries} attempts: {exc}")

        self.metrics["syncs_failed"] += 1
        duration = time.time() - start_time

        # Record failure metrics
        if self._metrics_exporter:
            self._metrics_exporter.record_sync("failed", duration)
            if self._circuit_breaker:
                self._metrics_exporter.update_circuit_breaker_state(
                    "ns3_sync", self._circuit_breaker.state_value
                )

        raise last_exception or RuntimeError("NS3 sync failed with no exception captured")

    def validate_receipt(self, receipt: Mapping[str, Any]) -> bool:
        """Validate an NS3 receipt using the configured signer."""

        if not isinstance(receipt, Mapping):
            return False

        payload = receipt.get("payload")
        signature = receipt.get("signature")
        ts_raw = receipt.get("timestamp")

        if not isinstance(payload, Mapping) or not isinstance(signature, str):
            return False

        receipt_ts = self._parse_timestamp(ts_raw) if ts_raw else None
        return self.signer.verify(payload, signature, timestamp=receipt_ts)

    def _calculate_drip_delta(self, snapshot: Mapping[str, Any], now: datetime) -> float:
        if "drip_delta" in snapshot:
            try:
                return float(snapshot["drip_delta"])
            except (TypeError, ValueError):
                pass

        history = snapshot.get("drip_history") or []
        cutoff = now - timedelta(hours=24)
        total = 0.0
        for entry in history:
            if not isinstance(entry, Mapping):
                continue
            ts_raw = entry.get("timestamp")
            value = entry.get("value") or entry.get("reward") or entry.get("amount")
            if ts_raw is None or value is None:
                continue
            ts = self._parse_timestamp(ts_raw)
            if ts >= cutoff:
                total += float(value)
        return total

    def _build_loop_recall_vector(self, snapshot: Mapping[str, Any]) -> str:
        if snapshot.get("loop_recall_vector"):
            return str(snapshot["loop_recall_vector"])

        history = snapshot.get("loop_history") or snapshot.get("loop_states") or []
        last_states = history[-7:]
        canonical = json.dumps(last_states, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _hash_snapshot(self, snapshot: Mapping[str, Any]) -> str:
        canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _extract_pop_score(self, snapshot: Mapping[str, Any]) -> float:
        candidates = [
            snapshot.get("PoP_score"),
            snapshot.get("pop_score"),
            snapshot.get("pop"),
        ]
        for candidate in candidates:
            if candidate is not None:
                return float(candidate)
        raise ValueError("snapshot missing PoP score")

    def _extract_amplifier_strength(self, snapshot: Mapping[str, Any]) -> float:
        candidates = [
            snapshot.get("amplifier_strength"),
            snapshot.get("amplifier", {}).get("strength") if isinstance(snapshot.get("amplifier"), Mapping) else None,
            snapshot.get("amplifier", {}).get("multiplier") if isinstance(snapshot.get("amplifier"), Mapping) else None,
            snapshot.get("amplifier_boost"),
        ]
        for candidate in candidates:
            if candidate is not None:
                return float(candidate)
        raise ValueError("snapshot missing amplifier strength")

    def _parse_timestamp(self, ts: Any) -> datetime:
        if isinstance(ts, datetime):
            return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        if isinstance(ts, (int, float)):
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        if isinstance(ts, str):
            try:
                cleaned = ts.replace("Z", "+00:00") if ts.endswith("Z") else ts
                parsed = datetime.fromisoformat(cleaned)
            except ValueError:
                raise
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        raise TypeError("timestamp must be a datetime, numeric epoch, or ISO string")

    def _validate_payload(self, payload: Mapping[str, Any]) -> None:
        required = {
            "validator_id",
            "belief_hash",
            "PoP_score",
            "amplifier_strength",
            "timestamp",
            "drip_delta",
            "loop_recall_vector",
            "nonce",
        }
        missing = sorted(required.difference(payload.keys()))
        if missing:
            raise ValueError(f"payload missing required fields: {', '.join(missing)}")
