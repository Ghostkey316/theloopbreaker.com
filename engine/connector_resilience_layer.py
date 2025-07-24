"""Connector Resilience Layer.

This module provides a fallback system when native connectors are unavailable.
It runs sandboxed from core protocol logic and keeps audit logs.
"""

from __future__ import annotations

import importlib.util
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from .health_sync_engine import encrypt_data

BASE_DIR = Path(__file__).resolve().parents[1]
CFG_PATH = BASE_DIR / "vaultfire-core" / "connector_resilience.json"
LOG_PATH = BASE_DIR / "logs" / "connector_resilience_log.json"
DEFAULT_CONNECTORS = ["openai", "github", "drive"]


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


def _load_cfg() -> Dict[str, Any]:
    return _load_json(CFG_PATH, {"endpoints": {}, "opt_in": {}})


def _save_cfg(cfg: Dict[str, Any]) -> None:
    _write_json(CFG_PATH, cfg)


def log_fallback_event(connector: str, event: str, extra: Dict[str, Any] | None = None) -> None:
    """Record a fallback event for audit."""
    log = _load_json(LOG_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "connector": connector,
        "event": event,
    }
    if extra:
        entry["meta"] = encrypt_data(json.dumps(extra), "vf")
    log.append(entry)
    _write_json(LOG_PATH, log)


def detect_missing_connectors(connectors: List[str] | None = None) -> List[str]:
    """Return a list of connectors that cannot be imported."""
    cfg = _load_cfg()
    if connectors is None:
        connectors = list(cfg.get("endpoints", {}).keys()) or DEFAULT_CONNECTORS
    missing: List[str] = []
    for name in connectors:
        if importlib.util.find_spec(name) is None:
            missing.append(name)
            log_fallback_event(name, "missing")
    return missing


def register_endpoint(connector: str, endpoint: str) -> None:
    """Register a secure endpoint for ``connector``."""
    cfg = _load_cfg()
    cfg.setdefault("endpoints", {})[connector] = endpoint
    _save_cfg(cfg)
    log_fallback_event(connector, "endpoint_registered", {"endpoint": endpoint})


def set_connector_enabled(connector: str, enabled: bool) -> None:
    """Opt in or out of a connector."""
    cfg = _load_cfg()
    cfg.setdefault("opt_in", {})[connector] = bool(enabled)
    _save_cfg(cfg)
    log_fallback_event(connector, "opt_in_changed", {"enabled": enabled})


def connector_enabled(connector: str) -> bool:
    cfg = _load_cfg()
    return bool(cfg.get("opt_in", {}).get(connector, False))


def manual_sync(connector: str, payload: Dict[str, Any], source: str, signature: str) -> Dict[str, Any]:
    """Validate and record a manual sync payload."""
    if not connector_enabled(connector):
        return {"status": "disabled"}
    if not isinstance(payload, dict):
        return {"status": "invalid_format"}
    if len(signature) < 8:
        return {"status": "invalid_signature"}
    log_fallback_event(connector, "manual_sync", {"source": source})
    return {"status": "ok", "records": len(payload)}


__all__ = [
    "detect_missing_connectors",
    "register_endpoint",
    "manual_sync",
    "log_fallback_event",
    "set_connector_enabled",
    "connector_enabled",
]
