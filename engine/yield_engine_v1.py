# Reference: ethics/core.mdx
"""Yield Engine v1 for Vaultfire."""

import json
from pathlib import Path
from datetime import datetime

from .loyalty_engine import loyalty_score
from .token_ops import send_token
from .mission_registry import get_mission

# Paths to data and config files
BASE_DIR = Path(__file__).resolve().parents[1]
VALUES_PATH = BASE_DIR / "vaultfire-core" / "ghostkey_values.json"
TRIGGER_PATH = BASE_DIR / "vaultfire-core" / "monetization" / "trigger_events.json"
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
AUDIT_LOG_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "morals_audit_log.json"

# Passive yield configuration
PASSIVE_LEDGER_PATH = BASE_DIR / "logs" / "passive_yield.json"
CERTIFIED_TIERS = {"origin", "veteran", "legend"}
PASSIVE_RATE = 0.02
RETRO_REWARD_PERCENT = 0.1
OG_LIST_PATH = BASE_DIR / "og_loyalists.json"


def _load_json(path):
    with open(path) as f:
        return json.load(f)


# --- Loyalty and verification helpers --------------------------------------

def _load_multiplier(user_id, wallet=None):
    """Return combined loyalty multiplier for ``user_id`` and wallet."""
    values = _load_json(VALUES_PATH)
    multipliers = values.get("loyalty_multipliers", {})
    base = multipliers.get(user_id, multipliers.get("default", 1.0))
    if wallet:
        try:
            from .wallet_loyalty import loyalty_multiplier
            base *= loyalty_multiplier(wallet)
        except Exception:
            pass
    return base


def _wallet_verified(wallet_address):
    """Very lightweight ENS/World ID check."""
    address = wallet_address.lower()
    return address.endswith(".eth") or address.startswith("world")


def _log_audit(entry):
    """Append an entry to morals_audit_log.json."""
    log = []
    if AUDIT_LOG_PATH.exists():
        with open(AUDIT_LOG_PATH) as f:
            try:
                log = json.load(f)
            except json.JSONDecodeError:
                log = []
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    entry_with_time = {"timestamp": timestamp, **entry}
    log.append(entry_with_time)
    with open(AUDIT_LOG_PATH, "w") as f:
        json.dump(log, f, indent=2)


# --- Loyalty certification & passive yield ---------------------------------

def loyalty_certified(user_id: str) -> bool:
    """Return ``True`` if ``user_id`` qualifies for loyalty certification."""
    info = loyalty_score(user_id)
    return info.get("tier") in CERTIFIED_TIERS


def calculate_passive_yield(user_id: str, wallet_address: str) -> float:
    """Return passive yield amount for ``user_id`` if certified."""
    info = loyalty_score(user_id)
    if info.get("tier") not in CERTIFIED_TIERS:
        return 0.0
    amount = info.get("score", 0) * PASSIVE_RATE
    if _wallet_verified(wallet_address):
        amount *= 1.1
    return amount


def distribute_passive_yield(contributor_data: dict) -> dict:
    """Generate passive yield ledger for loyalty-certified contributors."""
    config = _load_json(CONFIG_PATH)
    if not config.get("ethics_anchor", False):
        _log_audit({"action": "distribute_passive_yield", "approved": False,
                    "reason": "ethics_anchor disabled"})
        return {}

    ledger = {}
    for user_id, info in contributor_data.items():
        wallet = info.get("wallet")
        if not wallet or not loyalty_certified(user_id):
            continue
        amount = calculate_passive_yield(user_id, wallet)
        if amount <= 0:
            continue
        ledger[wallet] = {
            "amount": amount,
            "currency": "ASM",
            "morals_approved": True,
        }
        _log_audit({
            "action": "passive_yield",
            "user_id": user_id,
            "wallet": wallet,
            "amount": amount,
            "approved": True,
        })

    _update_passive_ledger(ledger)
    return ledger


def _update_passive_ledger(entries: dict) -> None:
    """Append ``entries`` to the passive yield ledger."""
    ledger = []
    if PASSIVE_LEDGER_PATH.exists():
        try:
            with open(PASSIVE_LEDGER_PATH) as f:
                ledger = json.load(f)
        except json.JSONDecodeError:
            ledger = []
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    for wallet, data in entries.items():
        ledger.append({"timestamp": timestamp, "wallet": wallet, **data})
    with open(PASSIVE_LEDGER_PATH, "w") as f:
        json.dump(ledger, f, indent=2)


# --- Yield Calculation ------------------------------------------------------

def calculate_yield(user_id, wallet_address, behavior_log):
    """Calculate weekly yield for a contributor."""
    triggers = set(_load_json(TRIGGER_PATH))
    base_score = sum(1 for event in behavior_log if event in triggers)
    multiplier = _load_multiplier(user_id, wallet_address)
    yield_score = base_score * multiplier
    if _wallet_verified(wallet_address):
        yield_score *= 1.15  # verification boost
    return yield_score


# --- Distribution -----------------------------------------------------------

def distribute_rewards(contributor_data):
    """Generate payout ledger for all contributors.

    Parameters
    ----------
    contributor_data : dict
        Mapping of user_id -> {"wallet": str, "behavior": list[str]}
    """
    config = _load_json(CONFIG_PATH)
    if not config.get("ethics_anchor", False):
        _log_audit({"action": "distribute_rewards", "approved": False,
                    "reason": "ethics_anchor disabled"})
        return {}

    ledger = {}
    for user_id, info in contributor_data.items():
        wallet = info.get("wallet")
        behavior = info.get("behavior", [])
        amount = calculate_yield(user_id, wallet, behavior)
        mission = get_mission(user_id)
        entry = {
            "amount": amount,
            "currency": "ASM",
            "morals_approved": True,
        }
        if mission:
            entry["mission_echo"] = mission
        ledger[wallet] = entry
        _log_audit({"action": "reward", "user_id": user_id,
                    "wallet": wallet, "approved": True,
                    "amount": amount})

    total = sum(v["amount"] for v in ledger.values())
    retro_total = total * RETRO_REWARD_PERCENT
    og_wallets = [w for w in _load_json(OG_LIST_PATH, []) if _wallet_verified(w)]
    retro_distribution = []
    if og_wallets and retro_total > 0:
        per_wallet = retro_total / len(og_wallets)
        for wallet in og_wallets:
            send_token(wallet, per_wallet, "ASM")
            retro_distribution.append({"wallet": wallet, "amount": per_wallet, "token": "ASM"})

    return {"rewards": ledger, "retro_rewards": retro_distribution}


# Placeholder for future v2 upgrades: social tipping, real-time badges, partner feeds


# --- Yield boost management --------------------------------------------------
BOOST_CANDIDATE_PATH = BASE_DIR / "logs" / "yield_boost.json"


def mark_yield_boost(user_id):
    """Flag user for yield boost consideration."""
    candidates = []
    if BOOST_CANDIDATE_PATH.exists():
        try:
            with open(BOOST_CANDIDATE_PATH) as f:
                candidates = json.load(f)
        except json.JSONDecodeError:
            candidates = []
    if user_id not in candidates:
        candidates.append(user_id)
        with open(BOOST_CANDIDATE_PATH, "w") as f:
            json.dump(candidates, f, indent=2)
        _log_audit({"action": "yield_boost_mark", "user_id": user_id})
