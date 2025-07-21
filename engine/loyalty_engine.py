# Reference: ethics/core.mdx
"""Loyalty Engine with tiered behavior multipliers."""

import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
VALUES_PATH = BASE_DIR / "vaultfire-core" / "ghostkey_values.json"
LOYALTY_RANKS_PATH = BASE_DIR / "dashboards" / "loyalty_ranks.json"
LOG_PATH = BASE_DIR / "logs" / "loyalty_engine_log.json"


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


def _log(entry: dict) -> None:
    log = _load_json(LOG_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    entry_with_time = {"timestamp": timestamp, **entry}
    log.append(entry_with_time)
    _write_json(LOG_PATH, log)


def _tier_multiplier(tier: str) -> float:
    values = _load_json(VALUES_PATH, {})
    multipliers = values.get("loyalty_multipliers", {})
    return multipliers.get(tier, multipliers.get("default", 1.0))


def _determine_tier(points: float) -> str:
    if points >= 300:
        return "legend"
    if points >= 150:
        return "veteran"
    if points >= 50:
        return "origin"
    return "default"


def loyalty_score(user_id: str) -> dict:
    scorecard = _load_json(SCORECARD_PATH, {})
    data = scorecard.get(user_id, {})
    base = data.get("loyalty", 0)
    tier = _determine_tier(base)
    multiplier = _tier_multiplier(tier)
    wallet = data.get("wallet")
    bond_mult = 1.0
    if wallet:
        try:
            from .wallet_bonding import bond_multiplier
            bond_mult = bond_multiplier(wallet)
        except Exception:
            pass
    score = base * multiplier * bond_mult
    return {"user_id": user_id, "base": base, "tier": tier, "score": score}


def update_loyalty_ranks() -> list[dict]:
    scorecard = _load_json(SCORECARD_PATH, {})
    ranks = [loyalty_score(uid) for uid in scorecard.keys()]
    ranks.sort(key=lambda x: x["score"], reverse=True)
    _write_json(LOYALTY_RANKS_PATH, ranks)
    _log({"action": "update_ranks", "count": len(ranks)})
    return ranks


if __name__ == "__main__":
    update_loyalty_ranks()
