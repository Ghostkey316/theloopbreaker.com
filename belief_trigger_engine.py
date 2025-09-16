"""Belief-based trigger system for Vaultfire."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.request
from datetime import datetime
from pathlib import Path

from engine.belief_multiplier import (
    _load_json as _load_belief_json,
    _score as _belief_score,
    SCORE_PATH as BELIEF_PATH,
)

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------


# Belief thresholds for trigger activation
BELIEF_THRESHOLDS = {
    "Spark": 10,
    "Torch": 30,
    "Flame": 60,
    "Inferno": 90,
}

LOG_PATH = Path("vault_trigger_log.json")
CHAIN_LOG_PATH = Path("chain_event_log.json")
DEFAULT_WEBHOOK_SECRET = os.environ.get("VAULTFIRE_WEBHOOK_SECRET")


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


def _build_signature(secret: str, body: bytes, *, timestamp: int) -> str:
    message = f"{timestamp}.".encode("utf-8") + body
    digest = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


def send_webhook(url: str, payload: dict, *, secret: str | None = None, retries: int = 3) -> None:
    """POST ``payload`` to ``url`` with optional HMAC authentication."""
    if not url:
        return

    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    secret_value = secret or DEFAULT_WEBHOOK_SECRET

    for attempt in range(retries):
        headers = {"Content-Type": "application/json"}
        if secret_value:
            timestamp = int(time.time())
            headers["X-Vaultfire-Signature"] = _build_signature(secret_value, body, timestamp=timestamp)
        req = urllib.request.Request(url, data=body, headers=headers)
        try:
            urllib.request.urlopen(req, timeout=5)
            break
        except Exception:
            if attempt == retries - 1:
                break
            time.sleep(0.2 * (2 ** attempt))


def send_to_webhook(
    url: str | None,
    wallet: str,
    tier: str,
    score: int,
    timestamp: str,
    trigger: str,
    chain_timestamp: str | None = None,
    *,
    secret: str | None = None,
) -> None:
    """Send activation data to ``url`` if provided with strict ordering."""
    if not url:
        return
    payload = {
        "wallet": wallet,
        "tier": tier,
        "score": score,
        "timestamp": timestamp,
        "trigger": trigger,
    }
    if list(payload.keys()) != [
        "wallet",
        "tier",
        "score",
        "timestamp",
        "trigger",
    ]:
        raise ValueError("Invalid payload order")
    if chain_timestamp:
        ts_payload = datetime.fromisoformat(timestamp)
        ts_chain = datetime.fromisoformat(chain_timestamp)
        if abs((ts_payload - ts_chain).total_seconds()) > 0.5:
            raise ValueError("Timestamp drift")
    send_webhook(url, payload, secret=secret)


def log_chain_event(wallet: str, tier: str, score: int, timestamp: str) -> None:
    """Record a chain-style log entry.

    Entries include wallet address, reward tier, score and timestamp to
    satisfy audit requirements. Keys are ordered to match the Vaultfire
    chain specification.
    """
    entry = {
        "wallet": wallet,
        "tier": tier,
        "score": score,
        "timestamp": timestamp,
    }
    _append_json(CHAIN_LOG_PATH, entry)


# Trigger functions ----------------------------------------------------------

def bonus_drop(wallet_id: str) -> dict:
    result = {
        "wallet": wallet_id,
        "trigger": "bonus_drop",
        "timestamp": datetime.utcnow().isoformat(),
    }
    return result


def unlock_nft_trait(wallet_id: str) -> dict:
    result = {
        "wallet": wallet_id,
        "trigger": "unlock_nft_trait",
        "timestamp": datetime.utcnow().isoformat(),
    }
    return result


def claim_reward(wallet_id: str) -> dict:
    result = {
        "wallet": wallet_id,
        "trigger": "claim_reward",
        "timestamp": datetime.utcnow().isoformat(),
    }
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
        "wallet": wallet_id,
        "trigger": "high_tier_reward",
        "message": "\ud83d\udd25 Flame Unlocked",
        "timestamp": datetime.utcnow().isoformat(),
    }
    return result


def mid_tier_reward(wallet_id: str) -> dict:
    result = {
        "wallet": wallet_id,
        "trigger": "mid_tier_reward",
        "timestamp": datetime.utcnow().isoformat(),
    }
    return result


def loyalty_ping(wallet_id: str) -> dict:
    result = {
        "wallet": wallet_id,
        "trigger": "loyalty_ping",
        "timestamp": datetime.utcnow().isoformat(),
    }
    return result


def belief_boost_suggestion(wallet_id: str) -> dict:
    result = {
        "wallet": wallet_id,
        "trigger": "belief_boost_suggestion",
        "timestamp": datetime.utcnow().isoformat(),
    }
    return result


def activate_belief_reward(
    wallet_id: str,
    score: int,
    *,
    chain_log: bool = False,
    webhook: str | None = None,
) -> dict:
    """Activate reward based on ``score`` and return activation entry.

    Parameters
    ----------
    wallet_id:
        Wallet to reward.
    score:
        Belief score determining tier.
    chain_log:
        If ``True`` also record the event in ``CHAIN_LOG_PATH`` with the score.
    webhook:
        Optional URL to POST activation data to.
    """
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
        "wallet": wallet_id,
        "tier": tier,
        "score": score,
        "timestamp": trigger_entry["timestamp"],
        "trigger": trigger_entry["trigger"],
    }
    _log_trigger(result)
    chain_ts = None
    if chain_log:
        chain_ts = result["timestamp"]
        log_chain_event(wallet_id, tier, score, chain_ts)
    if webhook:
        send_to_webhook(
            webhook,
            wallet_id,
            tier,
            score,
            result["timestamp"],
            result["trigger"],
            chain_ts,
        )
    return result


# Utility -------------------------------------------------------------------

def _get_belief_score(wallet_id: str) -> int:
    data = _load_belief_json(BELIEF_PATH)
    info = data.get(wallet_id, {})
    return _belief_score(info)


# Public API ----------------------------------------------------------------

def evaluate_wallet(
    wallet_id: str,
    *,
    chain_log: bool = False,
    webhook: str | None = None,
) -> dict:
    """Evaluate ``wallet_id`` and activate the correct trigger.

    Parameters
    ----------
    wallet_id:
        Wallet address to evaluate.
    chain_log:
        If ``True`` append the activation event to ``CHAIN_LOG_PATH`` with score.
    webhook:
        Optional URL to POST activation data to.
    """
    score = _get_belief_score(wallet_id)

    tier = None
    for name, threshold in sorted(BELIEF_THRESHOLDS.items(), key=lambda x: x[1], reverse=True):
        if score >= threshold:
            tier = name
            break

    result = {
        "wallet": wallet_id,
        "tier": tier,
        "score": score,
    }

    if tier:
        func = TRIGGERS.get(tier)
        if func:
            trigger_entry = func(wallet_id)
            result["timestamp"] = trigger_entry["timestamp"]
            result["trigger"] = trigger_entry["trigger"]
            _log_trigger(result)
            chain_ts = None
            if chain_log:
                chain_ts = result["timestamp"]
                log_chain_event(wallet_id, tier, score, chain_ts)
            if webhook:
                send_to_webhook(
                    webhook,
                    wallet_id,
                    tier,
                    score,
                    result["timestamp"],
                    result["trigger"],
                    chain_ts,
                )
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
        entry = activate_belief_reward(wallet, int(score))
        tier = entry.get("tier")
        if tier:
            counts[tier] += 1

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
        active = {e.get("wallet") for e in data}
        print("Active wallets:", ", ".join(sorted(active)))
    else:
        print("No active wallets")


if __name__ == "__main__":
    main()
