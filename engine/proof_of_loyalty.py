from __future__ import annotations

"""Proof-of-Loyalty token issuance for belief-aligned actions."""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict

from utils.json_io import load_json, write_json
from utils.notify_partner import notify_partner

from .token_ops import send_token
# ``vaultfire_signal_parser`` lives at the repo root rather than within
# ``engine`` so import it as a top-level module.
from vaultfire_signal_parser import parse_signal

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "proof_of_loyalty.json"


def record_belief_action(user_id: str, wallet: str, text: str) -> Dict:
    """Analyze ``text`` and mint LOYAL tokens if belief-aligned."""
    result = parse_signal(text)
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "wallet": wallet,
        "text": text,
        "score": result.get("score"),
        "verified": result.get("verified"),
    }
    log = load_json(LOG_PATH, [])
    log.append(entry)
    write_json(LOG_PATH, log)

    if result.get("verified"):
        try:
            send_token(wallet, 1, "LOYAL")
            entry["token_awarded"] = True
        except Exception as exc:
            notify_partner(
                {
                    "type": "error",
                    "module": "token",
                    "message": "Issuance failed",
                    "details": {"wallet": wallet, "reason": "proof_of_loyalty", "error": str(exc)},
                }
            )
            entry["token_awarded"] = False
    else:
        entry["token_awarded"] = False

    return entry


__all__ = ["record_belief_action"]
