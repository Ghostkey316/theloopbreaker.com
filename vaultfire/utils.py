"""Utility helpers for Vaultfire deployment flows."""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timezone
from typing import Optional

_DEFAULT_SIGNAL_SECRET = "vaultfire-dev-secret"
_DEFAULT_DEPLOY_SECRET = "vaultfire-deploy-secret"
_TIME_TOLERANCE_SECONDS = 5 * 60


def _load_secret(var_name: str, default: str) -> str:
    value = os.getenv(var_name, default).strip()
    return value or default


def _parse_timestamp(timestamp: str) -> Optional[datetime]:
    try:
        parsed = datetime.fromisoformat(timestamp)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def validate_integrity(hash_value: str, timestamp: str) -> bool:
    """Validate that the payload hash matches the expected HMAC signature."""

    parsed_timestamp = _parse_timestamp(timestamp)
    if not parsed_timestamp:
        return False

    now = datetime.now(timezone.utc)
    if abs((now - parsed_timestamp).total_seconds()) > _TIME_TOLERANCE_SECONDS:
        return False

    secret = _load_secret("VAULTFIRE_SIGNAL_SECRET", _DEFAULT_SIGNAL_SECRET)
    expected = hmac.new(
        secret.encode("utf-8"),
        timestamp.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, str(hash_value))


def sign_deployment(*, agent_id: str, env: str, timestamp: str) -> str:
    """Generate a deterministic signature for deployment metadata."""

    secret = _load_secret("VAULTFIRE_DEPLOY_SECRET", _DEFAULT_DEPLOY_SECRET)
    payload = f"{agent_id}:{env}:{timestamp}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


__all__ = ["sign_deployment", "validate_integrity"]
