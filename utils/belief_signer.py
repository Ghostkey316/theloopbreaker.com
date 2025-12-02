"""HMAC signing utilities for NS3 BeliefSync payloads."""
from __future__ import annotations

import hmac
import json
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping


class BeliefSigner:
    """Sign and verify BeliefSync payloads using rotating HMAC keys."""

    def __init__(self, secret: str, *, window_seconds: int = 60) -> None:
        if not secret:
            raise ValueError("secret must be provided")
        if window_seconds <= 0:
            raise ValueError("window_seconds must be positive")
        self._secret = secret.encode("utf-8")
        self.window_seconds = int(window_seconds)

    def sign(self, payload: Mapping[str, Any], *, timestamp: datetime | None = None) -> str:
        timestamp = timestamp or datetime.now(timezone.utc)
        return self._sign_with_key(payload, timestamp)

    def verify(
        self,
        payload: Mapping[str, Any],
        signature: str,
        *,
        timestamp: datetime | None = None,
        tolerance_windows: int = 1,
    ) -> bool:
        timestamp = timestamp or datetime.now(timezone.utc)
        canonical = self._canonical_payload(payload)
        for offset in range(-tolerance_windows, tolerance_windows + 1):
            candidate_ts = timestamp + timedelta(seconds=offset * self.window_seconds)
            derived_key = self._derive_key(candidate_ts)
            candidate_sig = hmac.new(derived_key, canonical, hashlib.sha256).hexdigest()
            if hmac.compare_digest(candidate_sig, signature):
                return True
        return False

    def _sign_with_key(self, payload: Mapping[str, Any], timestamp: datetime) -> str:
        key = self._derive_key(timestamp)
        canonical = self._canonical_payload(payload)
        return hmac.new(key, canonical, hashlib.sha256).hexdigest()

    def _derive_key(self, timestamp: datetime) -> bytes:
        ts = timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=timezone.utc)
        bucket = int(ts.timestamp()) // self.window_seconds
        return hmac.new(self._secret, str(bucket).encode("utf-8"), hashlib.sha256).digest()

    def _canonical_payload(self, payload: Mapping[str, Any]) -> bytes:
        return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
