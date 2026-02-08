"""Example: generate a signed x402 receipt (HMAC) and POST it to Vaultfire.

Usage:
  python scripts/x402_partner_webhook_example.py \
    --url http://localhost:5000/vaultfire/x402-webhook \
    --rail assemble \
    --secret dev-secret \
    --wallet bpow20.cb.id \
    --amount 0.00021 \
    --currency ASM \
    --txref asm_receipt_123

Canonical JSON includes only:
  rail,currency,amount,wallet_address,tx_ref,nonce,timestamp
Signature:
  hex(HMAC_SHA256(secret, canonical_json))
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict

try:
    import requests  # type: ignore
except Exception:  # pragma: no cover
    requests = None


def canonical_receipt(payload: Dict[str, Any]) -> str:
    msg = {
        "partner_id": payload.get("partner_id"),
        "key_id": payload.get("key_id") or "k1",
        "rail": payload["rail"],
        "currency": str(payload.get("currency") or "").upper(),
        "amount": payload.get("amount"),
        "wallet_address": payload.get("wallet_address"),
        "tx_ref": payload.get("tx_ref"),
        "nonce": payload.get("nonce"),
        "timestamp": payload.get("timestamp"),
    }
    return json.dumps(msg, separators=(",", ":"), sort_keys=True)


def hmac_hex(secret: str, message: str) -> str:
    return hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:5000/vaultfire/x402-webhook")
    ap.add_argument("--rail", default="assemble")
    ap.add_argument("--secret", default=os.getenv("X402_SECRET"))
    ap.add_argument("--wallet", default="bpow20.cb.id")
    ap.add_argument("--amount", type=float, default=0.00021)
    ap.add_argument("--currency", default="ASM")
    ap.add_argument("--txref", default=f"demo_{int(time.time())}")
    args = ap.parse_args()

    if not args.secret:
        raise SystemExit("Missing --secret (or set X402_SECRET)")

    payload: Dict[str, Any] = {
        "partner_id": args.rail,  # simplest: use rail name as partner_id
        "key_id": "k1",
        "rail": args.rail,
        "event_type": "payment",
        "status": "received",
        "currency": args.currency,
        "amount": args.amount,
        "wallet_address": args.wallet,
        "tx_ref": args.txref,
        "timestamp": int(time.time()),
        "nonce": secrets.token_hex(16),
    }

    message = canonical_receipt(payload)
    payload["signature"] = hmac_hex(args.secret, message)

    print("Canonical JSON:", message)
    print("Signature:", payload["signature"])

    if requests is None:
        raise SystemExit("requests not installed; pip install requests")

    res = requests.post(args.url, json=payload, timeout=10)
    print("HTTP", res.status_code)
    print(res.text)


if __name__ == "__main__":
    main()
