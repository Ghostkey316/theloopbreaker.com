"""Weekly drop scheduler using ghost scores and reward config."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict

from engine.ghostscore_engine import get_ghostscore
from engine.loyalty_engine import loyalty_score

BASE_DIR = Path(__file__).resolve().parent
REWARDS_PATH = BASE_DIR / "vaultfire_rewards.json"
CONFIG_PATH = BASE_DIR / "vault_config.json"
DROP_LOG_PATH = BASE_DIR / "logs" / "drop_schedule_log.json"
SCORES_PATH = BASE_DIR / "ghostscores.json"
INTEL_MAP_PATH = BASE_DIR / "overlays" / "intel_map.json"
PASSIVE_SYNC_PATH = BASE_DIR / "configs" / "passive_sync.json"
LOYALTY_TIER_PATH = BASE_DIR / "loyalty_tiers.json"

DEFAULT_CONFIG = {
    "weekly_drop_day": "Fri",
    "weekly_drop_hour_et": 16
}


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


def _intel_boost(wallet: str, ens: str) -> float:
    """Return additional drop amount from wallet intelligence."""
    intel = _load_json(INTEL_MAP_PATH, {})
    sync_cfg = _load_json(PASSIVE_SYNC_PATH, {})
    tiers = _load_json(LOYALTY_TIER_PATH, {})
    score = intel.get(wallet, {}).get("insightScore", 0)
    tier = tiers.get(ens, {}).get("tier", "Entry")
    mult = sync_cfg.get("multipliers", {}).get(tier, 1.0)
    return round(score * mult / 100.0, 3)


def _window_open(config: dict, now: datetime) -> bool:
    day = config.get("weekly_drop_day", "Fri")
    hour_et = config.get("weekly_drop_hour_et", 16)
    hour_utc = (hour_et + 4) % 24
    return now.strftime("%a") == day and now.hour == hour_utc


def schedule_drops(now: datetime | None = None) -> List[Dict]:
    dt = now or datetime.utcnow()
    config = _load_json(CONFIG_PATH, DEFAULT_CONFIG)
    if not config.get("weekly_drops_enabled", True):
        return []
    if not _window_open(config, dt):
        return []
    rewards = _load_json(REWARDS_PATH, {})
    results: List[Dict] = []
    for ens, info in rewards.items():
        wallet = info.get("wallet")
        payouts = info.get("payout", [])
        score = get_ghostscore(ens)
        multiplier = 1 + score / 100
        loyalty = loyalty_score(ens).get("score", 0)
        for p in payouts:
            amount = round(p.get("amount", 0) * multiplier, 3)
            if config.get("intel_loop"):
                amount += _intel_boost(wallet, ens)
            entry = {
                "timestamp": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "ens": ens,
                "wallet": wallet,
                "token": p.get("token"),
                "amount": round(amount, 3),
                "ghostscore": score,
                "loyalty": loyalty,
            }
            results.append(entry)
    if results:
        log = _load_json(DROP_LOG_PATH, [])
        log.extend(results)
        _write_json(DROP_LOG_PATH, log)
    return results


if __name__ == "__main__":
    print(json.dumps(schedule_drops(), indent=2))
