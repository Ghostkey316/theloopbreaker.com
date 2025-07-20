"""Yield Engine v1 for Vaultfire."""

import json
from pathlib import Path
from datetime import datetime

# Paths to data and config files
BASE_DIR = Path(__file__).resolve().parents[1]
VALUES_PATH = BASE_DIR / "vaultfire-core" / "ghostkey_values.json"
TRIGGER_PATH = BASE_DIR / "vaultfire-core" / "monetization" / "trigger_events.json"
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
AUDIT_LOG_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "morals_audit_log.json"


def _load_json(path):
    with open(path) as f:
        return json.load(f)


# --- Loyalty and verification helpers --------------------------------------

def _load_multiplier(user_id):
    """Return loyalty multiplier for the given user_id."""
    values = _load_json(VALUES_PATH)
    multipliers = values.get("loyalty_multipliers", {})
    return multipliers.get(user_id, multipliers.get("default", 1.0))


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


# --- Yield Calculation ------------------------------------------------------

def calculate_yield(user_id, wallet_address, behavior_log):
    """Calculate weekly yield for a contributor."""
    triggers = set(_load_json(TRIGGER_PATH))
    base_score = sum(1 for event in behavior_log if event in triggers)
    multiplier = _load_multiplier(user_id)
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
        ledger[wallet] = {
            "amount": amount,
            "currency": "ASM",
            "morals_approved": True,
        }
        _log_audit({"action": "reward", "user_id": user_id,
                    "wallet": wallet, "approved": True,
                    "amount": amount})
    return ledger


# Placeholder for future v2 upgrades: social tipping, real-time badges, partner feeds

