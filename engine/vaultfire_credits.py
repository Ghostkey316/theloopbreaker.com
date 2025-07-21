"""Manage Vaultfire credit balances.

Credits accrue from contributor XP and the
number of verified prompts a user submits. Balances are keyed by the user's ENS
name or Coinbase ID.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict

from .contributor_xp import xp_score

BASE_DIR = Path(__file__).resolve().parents[1]
CREDIT_PATH = BASE_DIR / "logs" / "vaultfire_credits.json"
EVENT_LOG_PATH = BASE_DIR / "event_log.json"


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


def _prompt_count(user_id: str) -> int:
    """Return number of verified prompts for ``user_id``."""
    log = _load_json(EVENT_LOG_PATH, [])
    return sum(1 for e in log if e.get("user_id") == user_id and e.get("event") == "verified_prompt")


def update_credit(user_id: str) -> Dict:
    """Recalculate credit balance for ``user_id`` and persist it."""
    xp_info = xp_score(user_id)
    wallet = xp_info.get("resolved_wallet") or xp_info.get("wallet") or user_id
    xp_val = xp_info.get("xp", 0)
    prompts = _prompt_count(user_id)

    credit = xp_val + prompts
    data = _load_json(CREDIT_PATH, {})
    data[wallet] = credit
    _write_json(CREDIT_PATH, data)
    return {"wallet": wallet, "credits": credit, "xp": xp_val, "verified_prompts": prompts}


def credit_balance(identifier: str) -> float:
    """Return current credit balance for ``identifier``."""
    data = _load_json(CREDIT_PATH, {})
    if identifier in data:
        return data[identifier]
    try:
        info = xp_score(identifier)
        wallet = info.get("resolved_wallet") or info.get("wallet") or identifier
        return data.get(wallet, 0.0)
    except Exception:
        return 0.0


def record_verified_prompt(user_id: str, prompt: str) -> Dict:
    """Record a verified prompt event and update credits."""
    log = _load_json(EVENT_LOG_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "event": "verified_prompt",
        "prompt": prompt,
    }
    log.append(entry)
    _write_json(EVENT_LOG_PATH, log)
    return update_credit(user_id)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Vaultfire credit utility")
    parser.add_argument("user_id", help="contributor id to calculate credit")
    args = parser.parse_args()
    info = update_credit(args.user_id)
    print(json.dumps(info, indent=2))
