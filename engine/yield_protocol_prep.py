"""Yield protocol prep for Vaultfire."""

import json
from pathlib import Path
from typing import Dict

from .yield_engine_v1 import distribute_passive_yield, mark_yield_boost
from .identity_resolver import resolve_identity

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
PREFS_PATH = BASE_DIR / "yield_prefs.json"
INSIGHTS_PATH = BASE_DIR / "dashboards" / "wallet_insights.json"

TARGET_ENS = "ghostkey316.eth"
TARGET_WALLET = "bpow20.cb.id"


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


def _behavior_count(metrics: Dict) -> int:
    return (
        metrics.get("belief_level", 0)
        + metrics.get("loyalty", 0)
        + metrics.get("impact_score", 0)
    )


def _is_opted_out(user_id: str, prefs: Dict) -> bool:
    return bool(prefs.get(user_id, {}).get("opt_out"))


def apply_yield_protocol() -> Dict:
    scorecard = _load_json(SCORECARD_PATH, {})
    prefs = _load_json(PREFS_PATH, {})
    insights = _load_json(INSIGHTS_PATH, {})

    ledger_input = {}
    for user_id, metrics in scorecard.items():
        if _is_opted_out(user_id, prefs):
            continue
        wallet = metrics.get("wallet", user_id)
        ens = metrics.get("ens")
        actions = _behavior_count(metrics)
        score = metrics.get("contributor_score", 0)
        if (ens == TARGET_ENS or wallet == TARGET_WALLET) and actions >= 100 and score > 900:
            ledger_input[user_id] = {"wallet": wallet}
            resolved = resolve_identity(wallet)
            insights[user_id] = {
                "income_tier": "tier-1",
                "resolved_wallet": resolved or wallet,
            }
            mark_yield_boost(user_id)

    if ledger_input:
        distribute_passive_yield(ledger_input)
        _write_json(INSIGHTS_PATH, insights)

    return ledger_input


if __name__ == "__main__":
    result = apply_yield_protocol()
    print(json.dumps(result, indent=2))
