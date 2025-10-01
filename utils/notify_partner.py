"""Broadcast partner-facing alerts from Python modules."""

from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

BUFFER_PATH = Path(__file__).resolve().parents[1] / "status" / "alerts-fallback.jsonl"


def _append_fallback(payload: Dict[str, Any]) -> None:
    BUFFER_PATH.parent.mkdir(parents=True, exist_ok=True)
    with BUFFER_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload) + "\n")


def notify_partner(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Send ``payload`` to the alert broker and persist to disk as a fallback."""

    entry = {
        "type": payload.get("type", "error"),
        "module": payload.get("module", "unknown"),
        "message": payload.get("message", ""),
        "timestamp": payload.get("timestamp")
        or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "details": payload.get("details", {}),
    }

    endpoint = os.getenv("VAULTFIRE_ALERT_ENDPOINT", "http://localhost:4800/alerts")
    data = json.dumps(entry).encode("utf-8")
    req = urllib.request.Request(endpoint, data=data, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=float(os.getenv("VAULTFIRE_ALERT_TIMEOUT", "5"))):
            pass
    except Exception:
        _append_fallback(entry)

    return entry


__all__ = ["notify_partner"]
