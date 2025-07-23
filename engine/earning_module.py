# Reference: ethics/core.mdx
"""Earning module rewarding positive contributions.

This module issues token rewards for meaningful engagement, completing
microtasks, submitting new ideas and building layers. Reward amounts
scale with the contributor's on-chain reputation.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from .identity_resolver import resolve_identity
from .score_oracle import fetch_scores, apr_multiplier
from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "earning_log.json"

BASE_REWARDS = {
    "engagement": 0.5,
    "microtask": 1.0,
    "idea": 2.0,
    "layer": 3.0,
}

SUPPORTED_TOKENS = {"ASM", "ETH", "USDC"}


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


def _resolve_wallet(wallet_or_ens: str) -> str:
    return resolve_identity(wallet_or_ens) or wallet_or_ens


def _reward_multiplier(user_id: str) -> float:
    scores = fetch_scores(user_id)
    return apr_multiplier(scores)


def _log_entry(entry: dict) -> None:
    log = _load_json(LOG_PATH, [])
    entry["timestamp"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    log.append(entry)
    _write_json(LOG_PATH, log)


def _reward_user(user_id: str, wallet: str, action: str, extra: Optional[dict], token: str) -> dict:
    if token not in SUPPORTED_TOKENS:
        raise ValueError(f"Unsupported token {token}")
    wallet_addr = _resolve_wallet(wallet)
    multiplier = _reward_multiplier(user_id)
    amount = BASE_REWARDS.get(action, 0) * multiplier
    if amount <= 0:
        return {}
    send_token(wallet_addr, amount, token)
    entry = {
        "user_id": user_id,
        "wallet": wallet_addr,
        "action": action,
        "amount": amount,
        "token": token,
    }
    if extra:
        entry.update(extra)
    _log_entry(entry)
    return entry


def reward_engagement(user_id: str, wallet: str, score: float = 1.0, token: str = "ASM") -> dict:
    extra = {"score": score}
    return _reward_user(user_id, wallet, "engagement", extra, token)


def reward_microtask(user_id: str, wallet: str, task_id: str, token: str = "ASM") -> dict:
    extra = {"task_id": task_id}
    return _reward_user(user_id, wallet, "microtask", extra, token)


def reward_idea(user_id: str, wallet: str, idea_id: str, token: str = "ASM") -> dict:
    extra = {"idea_id": idea_id}
    return _reward_user(user_id, wallet, "idea", extra, token)


def reward_layer_build(user_id: str, wallet: str, layer: str, token: str = "ASM") -> dict:
    extra = {"layer": layer}
    return _reward_user(user_id, wallet, "layer", extra, token)


__all__ = [
    "reward_engagement",
    "reward_microtask",
    "reward_idea",
    "reward_layer_build",
]
