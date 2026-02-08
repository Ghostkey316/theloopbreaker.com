"""Receipt signing + replay protection for third-party x402 rails.

This module is intentionally lightweight and mission-aligned:
- validates *payment receipts* without requiring identity metadata
- supports shared-secret HMAC signing for quick partner integration

Production hardening ideas:
- switch to asymmetric signatures (ed25519 / secp256k1) + key rotation
- per-partner allowlists + rate limiting
- stronger canonicalization rules + schema enforcement
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping


NONCE_STATE_PATH = Path("logs/x402_nonce_state.json")
DEFAULT_MAX_SKEW_SECONDS = 300  # 5 minutes
DEFAULT_NONCE_TTL_SECONDS = 900  # 15 minutes

# Optional partner key registry (do NOT commit secrets; use env).
#
# Env vars:
#   VAULTFIRE_X402_PARTNER_KEYS_JSON  -> JSON mapping partner_id -> key_id -> secret
#   VAULTFIRE_X402_PARTNER_KEYS_PATH  -> path to a JSON file with the same mapping
#
# Example:
# {
#   "assemble": {"k1": "supersecret"},
#   "ns3": {"k1": "anothersecret"}
# }


@dataclass(frozen=True, slots=True)
class ReceiptVerificationResult:
    ok: bool
    reason: str | None = None


def _canonical_receipt_message(payload: Mapping[str, Any]) -> str:
    """Return canonical JSON string for signing.

    Only includes a minimal, privacy-safe set of fields.

    IMPORTANT: include partner_id + key_id so the same nonce/signature
    cannot be replayed across issuers.
    """

    msg = {
        "partner_id": payload.get("partner_id") or payload.get("issuer"),
        "key_id": payload.get("key_id") or payload.get("kid") or "k1",
        "rail": payload.get("rail") or payload.get("provider"),
        "currency": (payload.get("currency") or "").upper(),
        "amount": payload.get("amount"),
        "wallet_address": payload.get("wallet_address") or payload.get("wallet"),
        "tx_ref": payload.get("tx_ref") or payload.get("tx_hash") or payload.get("transaction_hash"),
        "nonce": payload.get("nonce"),
        "timestamp": payload.get("timestamp"),
    }
    return json.dumps(msg, separators=(",", ":"), sort_keys=True)


def _hmac_digest(message: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()


def _load_nonce_state() -> dict[str, float]:
    if NONCE_STATE_PATH.exists():
        try:
            data = json.loads(NONCE_STATE_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return {str(k): float(v) for k, v in data.items()}
        except Exception:
            return {}
    return {}


def _store_nonce_state(state: Mapping[str, float]) -> None:
    NONCE_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with NONCE_STATE_PATH.open("w", encoding="utf-8") as fp:
        json.dump(dict(state), fp, indent=2, sort_keys=True)


def _check_and_mark_nonce(nonce_key: str, *, now: float, ttl_seconds: int) -> bool:
    """Return True if nonce is new; False if replay."""

    state = _load_nonce_state()
    # prune
    cutoff = now - ttl_seconds
    state = {k: v for (k, v) in state.items() if v >= cutoff}
    if nonce_key in state:
        _store_nonce_state(state)
        return False
    state[nonce_key] = now
    _store_nonce_state(state)
    return True


def verify_hmac_receipt(
    payload: Mapping[str, Any],
    *,
    secret: str,
    require_partner: bool = True,
    max_skew_seconds: int = DEFAULT_MAX_SKEW_SECONDS,
    nonce_ttl_seconds: int = DEFAULT_NONCE_TTL_SECONDS,
) -> ReceiptVerificationResult:
    """Verify a partner webhook payload using HMAC.

    Expected fields:
      - signature: hex(HMAC_SHA256(secret, canonical_json))
      - timestamp: unix seconds
      - nonce: unique random string

    The canonical JSON includes only: rail,currency,amount,wallet_address,tx_ref,nonce,timestamp.
    """

    signature = payload.get("signature") or payload.get("receipt_signature")
    if not signature or not isinstance(signature, str):
        return ReceiptVerificationResult(False, "missing signature")

    partner_id = payload.get("partner_id") or payload.get("issuer")
    if require_partner and (not partner_id or not isinstance(partner_id, str)):
        return ReceiptVerificationResult(False, "missing partner_id")

    key_id = payload.get("key_id") or payload.get("kid") or "k1"
    if require_partner and (not key_id or not isinstance(key_id, str)):
        return ReceiptVerificationResult(False, "missing key_id")

    nonce = payload.get("nonce")
    if not nonce or not isinstance(nonce, str):
        return ReceiptVerificationResult(False, "missing nonce")

    ts = payload.get("timestamp")
    try:
        ts_value = float(ts)
    except (TypeError, ValueError):
        return ReceiptVerificationResult(False, "invalid timestamp")

    now = time.time()
    if abs(now - ts_value) > max_skew_seconds:
        return ReceiptVerificationResult(False, "timestamp skew too large")

    nonce_key = f"{partner_id or 'unknown'}:{key_id}:{nonce}"
    if not _check_and_mark_nonce(nonce_key, now=now, ttl_seconds=nonce_ttl_seconds):
        return ReceiptVerificationResult(False, "replayed nonce")

    message = _canonical_receipt_message(payload)
    expected = _hmac_digest(message, secret)
    if not hmac.compare_digest(expected, signature.strip().lower()):
        return ReceiptVerificationResult(False, "signature mismatch")

    return ReceiptVerificationResult(True, None)


def _load_partner_key_registry() -> dict[str, dict[str, str]]:
    raw = os.getenv("VAULTFIRE_X402_PARTNER_KEYS_JSON")
    path = os.getenv("VAULTFIRE_X402_PARTNER_KEYS_PATH")
    data: Any = None
    if raw:
        try:
            data = json.loads(raw)
        except Exception:
            data = None
    elif path:
        try:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        except Exception:
            data = None

    if isinstance(data, dict):
        out: dict[str, dict[str, str]] = {}
        for partner_id, keyset in data.items():
            if not isinstance(partner_id, str) or not isinstance(keyset, dict):
                continue
            out[partner_id] = {str(k): str(v) for (k, v) in keyset.items() if v is not None}
        return out
    return {}


def get_partner_secret(rail: str | None) -> str | None:
    """Backward-compatible single-secret lookup for a rail."""

    if not rail:
        return None
    rail_norm = str(rail).lower()
    if rail_norm == "assemble":
        return os.getenv("VAULTFIRE_X402_ASSEMBLE_SECRET")
    if rail_norm == "ns3":
        return os.getenv("VAULTFIRE_X402_NS3_SECRET")
    return None


def get_partner_secret_by_id(*, partner_id: str | None, key_id: str | None) -> str | None:
    """Preferred lookup: partner_id + key_id (supports rotation + allowlists)."""

    if not partner_id:
        return None
    registry = _load_partner_key_registry()
    keyset = registry.get(str(partner_id))
    if not keyset:
        return None
    kid = str(key_id or "k1")
    return keyset.get(kid)
