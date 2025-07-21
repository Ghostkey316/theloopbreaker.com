# Reference: ethics/core.mdx
"""Wallet bonding system for shared loyalty bonuses."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Tuple

BASE_DIR = Path(__file__).resolve().parents[1]
BONDS_PATH = BASE_DIR / "logs" / "wallet_bonds.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"


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


def _pair_key(a: str, b: str) -> str:
    w1, w2 = sorted([a.lower(), b.lower()])
    return f"{w1}:{w2}"


def _trust_for_wallet(wallet: str) -> float:
    scorecard = _load_json(SCORECARD_PATH, {})
    for uid, data in scorecard.items():
        if data.get("wallet") == wallet:
            return float(data.get("trust_behavior", 0))
    return 0.0


def create_bond(wallet_a: str, wallet_b: str) -> dict:
    """Activate a bond between ``wallet_a`` and ``wallet_b``."""
    if wallet_a == wallet_b:
        raise ValueError("cannot bond wallet to itself")
    bonds = _load_json(BONDS_PATH, {})
    key = _pair_key(wallet_a, wallet_b)
    if key in bonds and bonds[key].get("active"):
        raise ValueError("bond already active")
    entry = {
        "wallets": [wallet_a, wallet_b],
        "start_time": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "active": True,
        "violations": 0,
    }
    bonds[key] = entry
    _write_json(BONDS_PATH, bonds)
    return entry


def break_bond(wallet_a: str, wallet_b: str, violation: bool = False) -> dict:
    """End an active bond. ``violation`` increments strike count."""
    bonds = _load_json(BONDS_PATH, {})
    key = _pair_key(wallet_a, wallet_b)
    entry = bonds.get(key)
    if not entry or not entry.get("active"):
        return {}
    entry["active"] = False
    entry["end_time"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    if violation:
        entry["violations"] = entry.get("violations", 0) + 1
    bonds[key] = entry
    _write_json(BONDS_PATH, bonds)
    return entry


def bond_multiplier(wallet: str) -> float:
    """Return loyalty/yield multiplier for ``wallet`` based on active bond."""
    bonds = _load_json(BONDS_PATH, {})
    for entry in bonds.values():
        if not entry.get("active"):
            continue
        wallets = entry.get("wallets", [])
        if wallet not in wallets:
            continue
        try:
            start = datetime.strptime(entry["start_time"], "%Y-%m-%dT%H:%M:%SZ")
        except (KeyError, ValueError):
            return 1.0
        weeks = max(0, (datetime.utcnow() - start).days // 7)
        time_factor = 1 + weeks * 0.05
        trust = (_trust_for_wallet(wallets[0]) + _trust_for_wallet(wallets[1])) / 2
        moral_factor = 1 + trust / 100.0
        return round(time_factor * moral_factor, 2)
    return 1.0


def slash_bond(wallet_a: str, wallet_b: str) -> Tuple[str, str]:
    """Break bond for rule violation and reset loyalty timers."""
    entry = break_bond(wallet_a, wallet_b, violation=True)
    if not entry:
        return (wallet_a, wallet_b)
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    state_path = BASE_DIR / "logs" / "wallet_loyalty_state.json"
    state = _load_json(state_path, {})
    for w in (wallet_a, wallet_b):
        info = state.get(w, {"balance": 0.0})
        info["start_time"] = now
        state[w] = info
    _write_json(state_path, state)
    return (wallet_a, wallet_b)
