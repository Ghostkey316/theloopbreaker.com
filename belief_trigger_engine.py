"""Belief-based trigger system for Vaultfire."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from engine.belief_multiplier import (
    _load_json as _load_belief_json,
    _score as _belief_score,
    SCORE_PATH as BELIEF_PATH,
)
from engine.loyalty_engine_v1 import loyalty_report


# Belief thresholds for trigger activation
BELIEF_THRESHOLDS = {
    "Spark": 10,
    "Torch": 30,
    "Flame": 60,
    "Inferno": 90,
}

LOG_PATH = Path("vault_trigger_log.json")


def _log_trigger(entry: dict) -> None:
    """Append ``entry`` to ``vault_trigger_log.json``."""
    if LOG_PATH.exists():
        try:
            log = json.loads(LOG_PATH.read_text())
        except json.JSONDecodeError:
            log = []
    else:
        log = []
    log.append(entry)
    LOG_PATH.write_text(json.dumps(log, indent=2))


# Trigger functions ----------------------------------------------------------

def bonus_drop(wallet_id: str) -> dict:
    result = {
        "wallet_id": wallet_id,
        "trigger": "bonus_drop",
        "timestamp": datetime.utcnow().isoformat(),
    }
    _log_trigger(result)
    return result


def unlock_nft_trait(wallet_id: str) -> dict:
    result = {
        "wallet_id": wallet_id,
        "trigger": "unlock_nft_trait",
        "timestamp": datetime.utcnow().isoformat(),
    }
    _log_trigger(result)
    return result


def claim_reward(wallet_id: str) -> dict:
    result = {
        "wallet_id": wallet_id,
        "trigger": "claim_reward",
        "timestamp": datetime.utcnow().isoformat(),
    }
    _log_trigger(result)
    return result


TRIGGERS = {
    "Spark": bonus_drop,
    "Torch": unlock_nft_trait,
    "Flame": claim_reward,
    "Inferno": claim_reward,
}


# Utility -------------------------------------------------------------------

def _get_belief_score(wallet_id: str) -> int:
    data = _load_belief_json(BELIEF_PATH)
    info = data.get(wallet_id, {})
    return _belief_score(info)


# Public API ----------------------------------------------------------------

def evaluate_wallet(wallet_id: str) -> dict:
    """Evaluate ``wallet_id`` and activate the correct trigger."""
    score = _get_belief_score(wallet_id)
    loyalty = loyalty_report(wallet_id)

    tier = None
    for name, threshold in sorted(BELIEF_THRESHOLDS.items(), key=lambda x: x[1], reverse=True):
        if score >= threshold:
            tier = name
            break

    result = {
        "wallet_id": wallet_id,
        "score": score,
        "tier": tier,
        "drop_score": loyalty.get("drop_score"),
    }

    if tier:
        func = TRIGGERS.get(tier)
        if func:
            trigger_entry = func(wallet_id)
            result["trigger"] = trigger_entry["trigger"]
    return result


def main() -> None:
    import unittest
    try:
        unittest.main(module="test_belief_trigger_engine", exit=False)
    except Exception:
        pass
    if LOG_PATH.exists():
        data = json.loads(LOG_PATH.read_text())
        active = {e["wallet_id"] for e in data}
        print("Active wallets:", ", ".join(sorted(active)))
    else:
        print("No active wallets")


if __name__ == "__main__":
    main()
