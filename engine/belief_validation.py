# Reference: ethics/core.mdx
"""Belief validation with ethical checkpointing."""

import json
import os
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
VALUES_PATH = BASE_DIR / "vaultfire-core" / "ghostkey_values.json"
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
CHECKPOINT_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "belief_checkpoints.json"

PROHIBITED_TERMS = ["pump", "scam", "deceive", "exploit", "harm"]


def _load_json(path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path, data):
    os.makedirs(path.parent, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _ethics_enabled():
    cfg = _load_json(CONFIG_PATH, {})
    return bool(cfg.get("ethics_anchor", False))


def _log_checkpoint(entry):
    log = _load_json(CHECKPOINT_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    log.append({"timestamp": timestamp, **entry})
    _write_json(CHECKPOINT_PATH, log)


def validate_belief(user_id, belief):
    """Validate ``belief`` for ``user_id`` and log result."""
    if not _ethics_enabled():
        _log_checkpoint({"user_id": user_id, "belief": belief,
                         "approved": False, "reason": "ethics_anchor disabled"})
        return False

    b_lower = belief.lower()
    if any(term in b_lower for term in PROHIBITED_TERMS):
        _log_checkpoint({"user_id": user_id, "belief": belief,
                         "approved": False, "reason": "prohibited_term"})
        return False

    values = _load_json(VALUES_PATH, {})
    keywords = [k.replace("_", " ") for k in values.keys()]
    aligned = any(word.lower() in b_lower for word in keywords)

    _log_checkpoint({"user_id": user_id, "belief": belief,
                     "approved": aligned, "reason": "auto-check"})
    return aligned


def get_user_checkpoints(user_id):
    """Return checkpoint log entries for ``user_id``."""
    log = _load_json(CHECKPOINT_PATH, [])
    return [e for e in log if e.get("user_id") == user_id]


if __name__ == "__main__":
    print(validate_belief("sample_user", "I believe in truth over hype"))
