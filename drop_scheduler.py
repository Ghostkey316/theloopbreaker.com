"""Weekly drop scheduler using ghost scores and reward config."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict

from engine.ghostscore_engine import get_ghostscore

BASE_DIR = Path(__file__).resolve().parent
REWARDS_PATH = BASE_DIR / "vaultfire_rewards.json"
CONFIG_PATH = BASE_DIR / "vault_config.json"
DROP_LOG_PATH = BASE_DIR / "logs" / "drop_schedule_log.json"
SCORES_PATH = BASE_DIR / "ghostscores.json"

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


def _window_open(config: dict, now: datetime) -> bool:
    day = config.get("weekly_drop_day", "Fri")
    hour_et = config.get("weekly_drop_hour_et", 16)
    hour_utc = (hour_et + 4) % 24
    return now.strftime("%a") == day and now.hour == hour_utc


def schedule_drops(now: datetime | None = None) -> List[Dict]:
    dt = now or datetime.utcnow()
    config = _load_json(CONFIG_PATH, DEFAULT_CONFIG)
    if not _window_open(config, dt):
        return []
    rewards = _load_json(REWARDS_PATH, {})
    results: List[Dict] = []
    for ens, info in rewards.items():
        wallet = info.get("wallet")
        payouts = info.get("payout", [])
        score = get_ghostscore(ens)
        multiplier = 1 + score / 100
        for p in payouts:
            amount = round(p.get("amount", 0) * multiplier, 3)
            entry = {
                "timestamp": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "ens": ens,
                "wallet": wallet,
                "token": p.get("token"),
                "amount": amount,
                "ghostscore": score,
            }
            results.append(entry)
    if results:
        log = _load_json(DROP_LOG_PATH, [])
        log.extend(results)
        _write_json(DROP_LOG_PATH, log)
    return results


if __name__ == "__main__":
    print(json.dumps(schedule_drops(), indent=2))
