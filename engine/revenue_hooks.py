# Reference: ethics/core.mdx
"""Revenue distribution hooks for on-chain contracts."""

import json
from datetime import datetime
from pathlib import Path

from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
EARNERS_PATH = BASE_DIR / "earners.json"
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "revenue_share.json"
REVENUE_LOG_PATH = BASE_DIR / "logs" / "contract_revenue.json"


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


def _wallet_verified(wallet: str) -> bool:
    addr = wallet.lower()
    return addr.endswith(".eth") or addr.startswith("world") or addr.startswith("0x")


def _share_config() -> float:
    cfg = _load_json(CONFIG_PATH, {"share_percentage": 0.1})
    return float(cfg.get("share_percentage", 0.1))


# ---------------------------------------------------------------------------


def distribute_revenue(total_amount: float, token: str = "ASM") -> list[dict]:
    """Distribute ``total_amount`` across verified earners."""
    earners = _load_json(EARNERS_PATH, [])
    wallets = [w for w in earners if _wallet_verified(w)]
    if not wallets:
        return []
    per_wallet = total_amount / len(wallets)
    results = []
    for wallet in wallets:
        send_token(wallet, per_wallet, token)
        results.append({"wallet": wallet, "amount": per_wallet, "token": token})
    return results


def record_contract_revenue(contract: str, amount: float, token: str = "ASM") -> dict:
    """Record revenue from ``contract`` and distribute the configured share."""
    share_pct = _share_config()
    share_amount = amount * share_pct
    distribution = distribute_revenue(share_amount, token)

    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "contract": contract,
        "amount": amount,
        "token": token,
        "share_pct": share_pct,
        "share_distributed": share_amount,
        "distribution": distribution,
    }
    log = _load_json(REVENUE_LOG_PATH, [])
    log.append(entry)
    _write_json(REVENUE_LOG_PATH, log)
    return entry
