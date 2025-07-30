"""Automated refund system for Vaultfire.

DISCLAIMER:
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from utils.json_io import load_json, write_json
from vaultfire.access.rbac import has_permission

# Default log and state paths
AUDIT_LOG_PATH = Path("refund_audit.json")
TX_LOG_PATH = Path("simulated_tx.json")
STATE_PATH = Path("refund_state.json")
BADGE_PATH = Path("frontend") / "refund_badges.json"


def is_frozen() -> bool:
    """Return True if refunds are currently frozen."""
    state = load_json(STATE_PATH, {"frozen": False})
    return bool(state.get("frozen"))


def freeze_refunds(user_id: str, *, override_key: str | None = None) -> bool:
    """Disable automatic refunds if caller has permission."""
    if not has_permission(user_id, "freeze_refunds", override_key):
        return False
    write_json(STATE_PATH, {"frozen": True})
    return True


def unfreeze_refunds(user_id: str, *, override_key: str | None = None) -> bool:
    """Enable automatic refunds if caller has permission."""
    if not has_permission(user_id, "unfreeze_refunds", override_key):
        return False
    write_json(STATE_PATH, {"frozen": False})
    return True


def should_refund(
    *,
    error_code: Optional[int] = None,
    latency: Optional[float] = None,
    failure_rate: Optional[float] = None,
    latency_threshold: float = 3.0,
    failure_rate_threshold: float = 0.25,
) -> bool:
    """Return True if conditions warrant an automatic refund."""
    if error_code is not None and error_code >= 500:
        return True
    if latency is not None and latency > latency_threshold:
        return True
    if failure_rate is not None and failure_rate > failure_rate_threshold:
        return True
    return False


def _log_audit(entry: Dict[str, Any]) -> None:
    log = load_json(AUDIT_LOG_PATH, [])
    log.append(entry)
    write_json(AUDIT_LOG_PATH, log)


def _record_tx(wallet: str, chain: str) -> None:
    tx = load_json(TX_LOG_PATH, [])
    tx.append(
        {
            "wallet": wallet,
            "chain": chain,
            "token": "REFUND",
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    )
    write_json(TX_LOG_PATH, tx)


def _issue_badge(wallet: str) -> None:
    badges = load_json(BADGE_PATH, {})
    badges[wallet] = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    }
    write_json(BADGE_PATH, badges)


def auto_refund(
    wallet: str,
    incident: str,
    *,
    chain: str = "ETH",
    metrics: Optional[Dict[str, float]] = None,
    admin_override: bool = False,
    user_id: str = "anonymous",
    override_key: str | None = None,
) -> Dict[str, Any]:
    """Process a refund for ``wallet`` if not frozen."""
    if is_frozen() and not (
        admin_override and has_permission(user_id, "unfreeze_refunds", override_key)
    ):
        return {"status": "frozen"}

    entry = {
        "wallet": wallet,
        "incident": incident,
        "chain": chain,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if metrics:
        entry["metrics"] = metrics

    status = "success"
    try:
        _record_tx(wallet, chain)
    except Exception as exc:  # pragma: no cover - unforeseen IO failure
        entry["error"] = str(exc)
        status = "failover"
    entry["status"] = status
    _log_audit(entry)
    _issue_badge(wallet)
    return entry


__all__ = [
    "auto_refund",
    "should_refund",
    "freeze_refunds",
    "unfreeze_refunds",
    "is_frozen",
]
