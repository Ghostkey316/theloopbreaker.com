"""Rank community healing methods and reward top contributors."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict

from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
REPORTS_PATH = BASE_DIR / "knowledge_repo" / "data" / "healing_reports.json"
RANKS_PATH = BASE_DIR / "dashboards" / "healing_method_ranks.json"
LOG_PATH = BASE_DIR / "logs" / "healing_reward_log.json"


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


def _trust_score(entry: Dict) -> float:
    reports = entry.get("verified_reports", 0)
    consistency = entry.get("consistent_results", 0.0)
    non_commercial = 0.1 if entry.get("non_commercial_backing") else 0.0
    score = reports * 0.5 + consistency * 0.4 + non_commercial
    return round(score, 2)


def rank_healing_methods() -> List[Dict]:
    """Return ranked healing methods sorted by trust score."""
    data = _load_json(REPORTS_PATH, [])
    ranked = []
    for item in data:
        score = _trust_score(item)
        ranked.append({**item, "trust_score": score})
    ranked.sort(key=lambda x: x["trust_score"], reverse=True)
    _write_json(RANKS_PATH, ranked)
    return ranked


def _log_reward(entry: dict) -> None:
    log = _load_json(LOG_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    log.append({"timestamp": timestamp, **entry})
    _write_json(LOG_PATH, log)


def reward_top_contributors(top_n: int = 3) -> List[Dict]:
    """Send recognition tokens to contributors of top-ranked methods."""
    ranked = rank_healing_methods()
    top = ranked[:top_n]
    rewards = []
    for item in top:
        wallet = item.get("contributor")
        if wallet:
            send_token(wallet, 1, "RECOG")
            entry = {"contributor": wallet, "method": item.get("method")}
            rewards.append(entry)
            _log_reward(entry)
    return rewards


if __name__ == "__main__":
    info = reward_top_contributors()
    print(json.dumps(info, indent=2))
