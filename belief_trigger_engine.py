"""Belief-based trigger system for Vaultfire."""
from __future__ import annotations

import json
import urllib.request
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
CHAIN_LOG_PATH = Path("chain_event_log.json")


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


def _append_json(path: Path, entry: dict) -> None:
    """Append ``entry`` to a JSON list at ``path``."""
    if path.exists():
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            data = []
    else:
        data = []
    data.append(entry)
    path.write_text(json.dumps(data, indent=2))


def send_webhook(url: str, payload: dict) -> None:
    """POST ``payload`` to ``url`` ignoring errors."""
    if not url:
        return
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass


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

# Additional reward triggers for CLI simulation

def high_tier_reward(wallet_id: str) -> dict:
    """Reward for very high belief scores."""
    result = {
        "wallet_id": wallet_id,
        "trigger": "high_tier_reward",
        "message": "\ud83d\udd25 Flame Unlocked",
        "timestamp": datetime.utcnow().isoformat(),
    }
    _log_trigger(result)
    return result


def mid_tier_reward(wallet_id: str) -> dict:
    result = {
        "wallet_id": wallet_id,
        "trigger": "mid_tier_reward",
        "timestamp": datetime.utcnow().isoformat(),
    }
    _log_trigger(result)
    return result


def loyalty_ping(wallet_id: str) -> dict:
    result = {
        "wallet_id": wallet_id,
        "trigger": "loyalty_ping",
        "timestamp": datetime.utcnow().isoformat(),
    }
    _log_trigger(result)
    return result


def belief_boost_suggestion(wallet_id: str) -> dict:
    result = {
        "wallet_id": wallet_id,
        "trigger": "belief_boost_suggestion",
        "timestamp": datetime.utcnow().isoformat(),
    }
    _log_trigger(result)
    return result


def activate_belief_reward(wallet_id: str, score: int, *, chain_log: bool = False) -> dict:
    """Activate reward based on ``score`` and return activation entry."""
    if score >= 90:
        func = high_tier_reward
        tier = "high"
    elif score >= 70:
        func = mid_tier_reward
        tier = "mid"
    elif score >= 50:
        func = loyalty_ping
        tier = "loyalty"
    else:
        func = belief_boost_suggestion
        tier = "boost"
    trigger_entry = func(wallet_id)
    result = {
        "wallet_id": wallet_id,
        "score": score,
        "tier": tier,
        "trigger": trigger_entry["trigger"],
        "timestamp": trigger_entry["timestamp"],
    }
    if chain_log:
        _append_json(
            CHAIN_LOG_PATH,
            {"wallet": wallet_id, "tier": tier, "timestamp": trigger_entry["timestamp"]},
        )
    return result


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


def simulate_cli(path: Path) -> None:
    """Run CLI simulation using ``path`` as the score dataset."""
    try:
        scores = json.loads(path.read_text())
    except Exception:
        print(f"Failed to load {path}")
        return

    counts = {"high": 0, "mid": 0, "loyalty": 0, "boost": 0}
    for wallet, score in scores.items():
        if score >= 90:
            high_tier_reward(wallet)
            counts["high"] += 1
        elif score >= 70:
            mid_tier_reward(wallet)
            counts["mid"] += 1
        elif score >= 50:
            loyalty_ping(wallet)
            counts["loyalty"] += 1
        else:
            belief_boost_suggestion(wallet)
            counts["boost"] += 1

    print(
        f"High tier: {counts['high']} Mid tier: {counts['mid']} Loyalty tier: {counts['loyalty']} Boost tier: {counts['boost']}"
    )


def main() -> None:
    import argparse
    import unittest

    parser = argparse.ArgumentParser(description="Belief trigger engine")
    parser.add_argument(
        "--simulate",
        help="Path to JSON file with wallet belief scores for CLI simulation",
    )
    parser.add_argument("--test", action="store_true", help="Run unit tests")
    args = parser.parse_args()

    if args.test:
        try:
            unittest.main(module="test_belief_trigger_engine", exit=False)
        except Exception:
            pass

    if args.simulate:
        simulate_cli(Path(args.simulate))

    if LOG_PATH.exists():
        data = json.loads(LOG_PATH.read_text())
        active = {e["wallet_id"] for e in data}
        print("Active wallets:", ", ".join(sorted(active)))
    else:
        print("No active wallets")


if __name__ == "__main__":
    main()
