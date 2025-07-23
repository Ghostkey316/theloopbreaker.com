from __future__ import annotations

"""Squad wallet management for pooled earnings and mission rewards."""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict

from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
WALLETS_PATH = BASE_DIR / "logs" / "squad_wallets.json"


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


def create_squad_wallet(squad_id: str, wallet: str) -> Dict:
    data = _load_json(WALLETS_PATH, {})
    if squad_id in data:
        return data[squad_id]
    entry = {"wallet": wallet, "log": []}
    data[squad_id] = entry
    _write_json(WALLETS_PATH, data)
    return entry


def record_earning(squad_id: str, amount: float, token: str) -> None:
    data = _load_json(WALLETS_PATH, {})
    entry = data.get(squad_id)
    if not entry:
        return
    wallet = entry.get("wallet")
    try:
        send_token(wallet, amount, token)
    except Exception:
        pass
    entry.setdefault("log", []).append({
        "amount": amount,
        "token": token,
        "time": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    data[squad_id] = entry
    _write_json(WALLETS_PATH, data)


def mission_reward(squad_id: str, mission: str, amount: float, token: str = "ASM") -> None:
    data = _load_json(WALLETS_PATH, {})
    entry = data.get(squad_id)
    if not entry:
        return
    wallet = entry.get("wallet")
    try:
        send_token(wallet, amount, token)
    except Exception:
        pass
    entry.setdefault("missions", []).append({
        "mission": mission,
        "amount": amount,
        "token": token,
        "time": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    data[squad_id] = entry
    _write_json(WALLETS_PATH, data)


def squad_wallet(squad_id: str) -> Dict | None:
    return _load_json(WALLETS_PATH, {}).get(squad_id)


__all__ = [
    "create_squad_wallet",
    "record_earning",
    "mission_reward",
    "squad_wallet",
]
