from __future__ import annotations

"""Proof-of-Loyalty token issuance for belief-aligned actions."""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict

from .token_ops import send_token
from .vaultfire_signal_parser import parse_signal

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "proof_of_loyalty.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


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
    log = _load_json(LOG_PATH, [])
    log.append(entry)
    _write_json(LOG_PATH, log)

    if result.get("verified"):
        try:
            send_token(wallet, 1, "LOYAL")
            entry["token_awarded"] = True
        except Exception:
            entry["token_awarded"] = False
    else:
        entry["token_awarded"] = False

    return entry


__all__ = ["record_belief_action"]
