from __future__ import annotations

"""Configurable partner revenue distribution engine."""

import json
from datetime import datetime
from pathlib import Path

from engine.token_ops import send_token
from engine.loyalty_engine import loyalty_score

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "partner_revenue.json"
PAYOUT_LOG = BASE_DIR / "logs" / "partner_revenue_log.json"


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


def set_config(partner_id: str, mode: str = "fixed", percent: float = 0.1,
               tiers: list | None = None, burn_pct: float = 0.0) -> None:
    """Store revenue config for ``partner_id``."""
    cfg = _load_json(CONFIG_PATH, {})
    cfg[partner_id] = {
        "mode": mode,
        "percent": percent,
        "tiers": tiers or [],
        "burn_pct": burn_pct,
    }
    _write_json(CONFIG_PATH, cfg)


def calc_share(partner_id: str, amount: float) -> float:
    """Return partner share of ``amount`` based on stored config."""
    cfg = _load_json(CONFIG_PATH, {}).get(partner_id, {"mode": "fixed", "percent": 0.1})
    mode = cfg.get("mode", "fixed")
    pct = float(cfg.get("percent", 0.1))
    tiers = cfg.get("tiers", [])
    burn_pct = float(cfg.get("burn_pct", 0.0))

    if mode == "tiered" and tiers:
        tiers_sorted = sorted(tiers, key=lambda t: t["threshold"])
        for t in tiers_sorted:
            if amount <= t["threshold"]:
                pct = t["percent"]
                break
        else:
            pct = tiers_sorted[-1]["percent"]
    elif mode == "burn-split":
        pct = pct * (1 - burn_pct)
    elif mode == "hybrid":
        pct = pct * (1 - burn_pct)
    return amount * pct


def payout(partner_id: str, wallet: str, amount: float, token: str = "ASM") -> dict:
    """Send ``amount`` to ``wallet`` and log the payout."""
    send_token(wallet, amount, token)
    log = _load_json(PAYOUT_LOG, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "partner_id": partner_id,
        "wallet": wallet,
        "amount": amount,
        "token": token,
    }
    log.append(entry)
    _write_json(PAYOUT_LOG, log)
    return entry


def apply_loyalty_bonus(user_id: str, base: float) -> float:
    """Return ``base`` amount adjusted by user's loyalty score."""
    score = loyalty_score(user_id).get("score", 0)
    return base * (1 + score / 100)
