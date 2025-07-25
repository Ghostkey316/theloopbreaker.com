"""Opt-in notification engine for Ghostkey AI Trader.

This module listens for trader events via ``vaultfire_core.protocol_notify``.
Notifications are filtered based on ``vaultfire_user_settings.json`` and can be
sent to different channels: terminal log, email log, or mobile webhook.
All alerts include the Ghostkey ID and use a belief-based message format.
"""
from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parent


def _get_settings_path() -> Path:
    """Return settings path respecting VF_USER_SETTINGS_PATH at call time."""
    return Path(
        os.environ.get("VF_USER_SETTINGS_PATH", str(BASE_DIR / "vaultfire_user_settings.json"))
    )
LOG_PATH = BASE_DIR / "logs" / "trader_notify_log.json"
EMAIL_LOG_PATH = BASE_DIR / "logs" / "trader_email_log.json"
DEFAULT_SETTINGS = {
    "notify_trader_activity": False,
    "notification_channel": "log_to_terminal",
    "webhook_url": "http://localhost:8060/notify",
}


def _load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _format_message(event: str, payload: Dict) -> str:
    base = f"Ghostkey-316 {event.replace('_', ' ')}"
    detail = payload.get("symbol") or payload.get("signals") or payload.get("error")
    if detail:
        return f"{base}: {detail}"
    return base


def _send_email(message: str) -> None:
    log = _load_json(EMAIL_LOG_PATH, [])
    log.append({"timestamp": datetime.utcnow().isoformat() + "Z", "message": message})
    _write_json(EMAIL_LOG_PATH, log)


def _send_webhook(url: str, payload: Dict) -> None:
    if not url:
        return
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass


def validate_notification_payload(payload: Dict) -> bool:
    """Ensure notification payload contains basic expected fields."""
    required_keys = ["ticker", "action", "confidence"]
    return all(key in payload for key in required_keys)


def notify_event(event: str, payload: Dict) -> Dict:
    settings = _load_json(_get_settings_path(), DEFAULT_SETTINGS)
    if not settings.get("notify_trader_activity"):
        return {"sent": False}
    if not validate_notification_payload(payload):
        payload = {
            "ticker": payload.get("ticker") or payload.get("symbol", ""),
            "action": payload.get("action", "unknown"),
            "confidence": payload.get("confidence", 0.0),
        }
    channel = settings.get("notification_channel", "log_to_terminal")
    message = _format_message(event, payload)
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "event": event,
        "payload": payload,
        "channel": channel,
        "message": message,
        "id": "Ghostkey-316",
    }
    if channel == "log_to_terminal":
        print(message)
    elif channel == "email":
        _send_email(message)
    elif channel == "mobile_webhook":
        _send_webhook(settings.get("webhook_url", ""), entry)
    log = _load_json(LOG_PATH, [])
    log.append(entry)
    _write_json(LOG_PATH, log)
    return entry


__all__ = ["notify_event", "validate_notification_payload"]
