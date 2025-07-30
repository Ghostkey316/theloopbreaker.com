"""Failsafe Recovery Layer.

Provides simple recovery and migration helpers using a JSON ledger.
Supports multisig + biometric placeholders and PrivacyGuard wipe logic.
"""
from __future__ import annotations

from pathlib import Path
from datetime import datetime

from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parent
LEDGER_PATH = BASE_DIR / "recovery_ledger.json"




def request_recovery(user_id: str, new_device: str) -> dict:
    ledger = load_json(LEDGER_PATH, [])
    entry = {
        "user_id": user_id,
        "new_device": new_device,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    ledger.append(entry)
    write_json(LEDGER_PATH, ledger)
    return entry


def privacy_wipe(user_id: str) -> None:
    ledger = load_json(LEDGER_PATH, [])
    ledger.append({
        "user_id": user_id,
        "action": "wipe",
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    write_json(LEDGER_PATH, ledger)


__all__ = ["request_recovery", "privacy_wipe"]
