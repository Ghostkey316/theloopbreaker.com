"""Vault Memory Snapshot System.

This module maintains long-term loyalty snapshots for
wallets based on ``intel_map.json`` insight scores.
Snapshots are stored under ``memory_snapshots/`` and
compared to highlight improving wallets.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional

INTEL_MAP_PATH = Path("overlays/intel_map.json")
CONFIG_PATH = Path("vault_config.json")
SNAPSHOT_DIR = Path("memory_snapshots")
LOG_PATH = Path("logs") / "vault_memory_log.json"

DEFAULT_CONFIG = {
    "memory_tracking": False,
    "memory_snapshot_days": 30,
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


def _log(entry: Dict[str, Any]) -> None:
    log = _load_json(LOG_PATH, [])
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    log.append({"timestamp": ts, **entry})
    _write_json(LOG_PATH, log)


def _latest_snapshot() -> Optional[tuple[datetime, Path]]:
    files = sorted(SNAPSHOT_DIR.glob("wallet_memory_*.json"))
    if not files:
        return None
    latest = files[-1]
    date_str = latest.stem.replace("wallet_memory_", "")
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None
    return dt, latest


def snapshot_memory(now: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """Create a loyalty snapshot if due and return the snapshot data."""
    cfg = _load_json(CONFIG_PATH, DEFAULT_CONFIG)
    if not cfg.get("memory_tracking"):
        _log({"action": "snapshot_skipped", "reason": "tracking_disabled"})
        return None
    freq = int(cfg.get("memory_snapshot_days", 30))
    now = now or datetime.utcnow()
    last = _latest_snapshot()
    if last and now - last[0] < timedelta(days=freq):
        _log({"action": "snapshot_skipped", "reason": "not_due"})
        return None

    intel = _load_json(INTEL_MAP_PATH, {})
    prev_scores = {}
    if last:
        prev_scores = _load_json(last[1], {})
    snapshot: Dict[str, Any] = {}
    for wallet, info in intel.items():
        score = info.get("insightScore", 0)
        prev = prev_scores.get(wallet, {}).get("score")
        bonus = prev is not None and score > prev
        entry = {"score": score}
        if bonus:
            entry["bonus"] = True
        snapshot[wallet] = entry
    SNAPSHOT_DIR.mkdir(exist_ok=True)
    path = SNAPSHOT_DIR / f"wallet_memory_{now.strftime('%Y-%m-%d')}.json"
    _write_json(path, snapshot)
    _log({"action": "snapshot_created", "file": str(path)})
    return snapshot


def check_loyalty_growth(wallet_id: str) -> str:
    """Return loyalty trend for ``wallet_id`` across snapshots."""
    files = sorted(SNAPSHOT_DIR.glob("wallet_memory_*.json"))
    if len(files) < 2:
        return "Flat"
    first = _load_json(files[0], {})
    last = _load_json(files[-1], {})
    start = first.get(wallet_id, {}).get("score", 0)
    end = last.get(wallet_id, {}).get("score", 0)
    if end > start:
        return "Grew"
    if end < start:
        return "Dropped"
    return "Flat"


# ----------------------------- Test Harness -----------------------------

def _test():
    """Run basic test using mock data."""
    SNAPSHOT_DIR.mkdir(exist_ok=True)
    # Mock intel map with three wallets
    intel = {
        "w1": {"insightScore": 10},
        "w2": {"insightScore": 20},
        "w3": {"insightScore": 5},
    }
    _write_json(INTEL_MAP_PATH, intel)
    # Create two historical snapshots
    old1 = {
        "w1": {"score": 5},
        "w2": {"score": 18},
        "w3": {"score": 5},
    }
    old2 = {
        "w1": {"score": 7},
        "w2": {"score": 18},
        "w3": {"score": 4},
    }
    d1 = datetime.utcnow() - timedelta(days=60)
    d2 = datetime.utcnow() - timedelta(days=30)
    _write_json(SNAPSHOT_DIR / f"wallet_memory_{d1.strftime('%Y-%m-%d')}.json", old1)
    _write_json(SNAPSHOT_DIR / f"wallet_memory_{d2.strftime('%Y-%m-%d')}.json", old2)
    cfg = _load_json(CONFIG_PATH, DEFAULT_CONFIG)
    cfg.update({"memory_tracking": True, "memory_snapshot_days": 30})
    _write_json(CONFIG_PATH, cfg)
    snapshot_memory()
    for w in intel:
        print(w, check_loyalty_growth(w))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        _test()
    else:
        snapshot_memory()
