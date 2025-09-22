"""Second Chance Principle enforcement helpers."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "vaultfire_config.json"
LOG_PATH = BASE_DIR / "logs" / "second_chance_log.json"
FEED_PATH = BASE_DIR / "dashboards" / "second_chance_feed.json"

_DEFAULT_FLAGS: Dict[str, Any] = {
    "allow_behavior_redemption": False,
    "never_lock_out_identity": False,
    "ethics_priority_override": False,
    "second_chance_window": "none",
    "public_forgiveness_layer": False,
}


def _load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            with open(path) as handle:
                return json.load(handle)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as handle:
        json.dump(data, handle, indent=2)


def _truthy(value: Any) -> bool:
    if isinstance(value, str):
        return value.lower() in {"true", "1", "enabled", "active", "yes"}
    return bool(value)


def get_policy_flags() -> Dict[str, Any]:
    """Return the configured Second Chance Principle flags."""
    cfg = _load_json(CONFIG_PATH, {})
    flags = deepcopy(_DEFAULT_FLAGS)
    section = cfg.get("second_chance_principle")
    if isinstance(section, dict):
        for key in _DEFAULT_FLAGS:
            if key in section:
                flags[key] = section[key]
    else:
        for key in _DEFAULT_FLAGS:
            if key in cfg:
                flags[key] = cfg[key]
    return flags


def _log_redemption(entry: Dict[str, Any], flags: Dict[str, Any]) -> None:
    log = _load_json(LOG_PATH, [])
    log.append(entry)
    _write_json(LOG_PATH, log)
    if _truthy(flags.get("public_forgiveness_layer")):
        feed = _load_json(FEED_PATH, [])
        feed.append(entry)
        # Keep the public feed manageable
        _write_json(FEED_PATH, feed[-100:])


def apply_second_chance(user_id: str, metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Apply the Second Chance Principle to ``metrics`` if required."""
    flags = get_policy_flags()
    if not (_truthy(flags.get("allow_behavior_redemption")) and _truthy(flags.get("ethics_priority_override"))):
        return metrics

    updated = deepcopy(metrics)
    before_trust = updated.get("trust_behavior")
    changed = False

    if isinstance(before_trust, (int, float)) and before_trust < 0:
        window = str(flags.get("second_chance_window", "none")).lower()
        if window in {"permanent", "always", "infinite"}:
            new_trust = min(0, before_trust + 1)
        else:
            new_trust = min(0, before_trust + 0.5)
        updated["trust_behavior"] = new_trust
        changed = new_trust != before_trust

    if _truthy(flags.get("never_lock_out_identity")):
        status = updated.get("status")
        if isinstance(status, str) and status.lower() in {"locked", "banned", "suspended"}:
            updated["status"] = "review"
            changed = True

    if changed:
        entry = {
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "user_id": user_id,
            "before": metrics,
            "after": updated,
            "policy": "Second Chance Principle",
        }
        _log_redemption(entry, flags)

    return updated


__all__ = ["apply_second_chance", "get_policy_flags"]
