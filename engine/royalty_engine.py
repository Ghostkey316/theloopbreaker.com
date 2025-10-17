"""Ghostkey attribution and royalty utilities."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "royalty_log.json"
ROYALTY_WALLET = "bpow20.cb.id"
DEFAULT_AMOUNT = 0.1
DEFAULT_TOKEN = "GHOSTKEY"
ROYALTY_TERMS = {
    "recipient": "Ghostkey-316",
    "ens": "ghostkey316.eth",
    "wallet": ROYALTY_WALLET,
    "rights": "lifetime",
    "retroactive": True,
    "protocol_manifest": "protocol/creator_coin_protocol.json",
}


def _load_log() -> list:
    if LOG_PATH.exists():
        try:
            with open(LOG_PATH) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return []
    return []


def _write_log(entries: list) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "w") as f:
        json.dump(entries, f, indent=2)


def trigger_royalty(event: str, amount: float = DEFAULT_AMOUNT, token: str = DEFAULT_TOKEN) -> dict:
    """Send a royalty payout and record the event."""
    send_token(ROYALTY_WALLET, amount, token)
    log = _load_log()
    entry = {
        "event": event,
        "amount": amount,
        "token": token,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "terms": dict(ROYALTY_TERMS),
    }
    log.append(entry)
    _write_log(log)
    return entry


__all__ = ["trigger_royalty"]
