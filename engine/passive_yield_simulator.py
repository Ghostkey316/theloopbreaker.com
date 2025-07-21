# Reference: ethics/core.mdx
"""Simulate passive yield payouts based on engagement and loyalty."""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List

if __package__:
    from .loyalty_engine import loyalty_score
    from .token_ops import send_token
else:  # pragma: no cover - executed as script
    import sys
    import importlib
    CURRENT = Path(__file__).resolve()
    sys.path.append(str(CURRENT.parents[1]))
    loyalty_engine = importlib.import_module("engine.loyalty_engine")
    token_ops = importlib.import_module("engine.token_ops")
    loyalty_score = loyalty_engine.loyalty_score
    send_token = token_ops.send_token

BASE_DIR = Path(__file__).resolve().parents[1]

RETRO_REWARD_PERCENT = 0.1
OG_LIST_PATH = BASE_DIR / "og_loyalists.json"


SUPPORTED_TOKENS = {"ASM", "USDC", "ETH"}


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


LEDGER_PATH = BASE_DIR / "logs" / "passive_yield_sim.json"


# ---------------------------------------------------------------------------


def simulate_passive_yield(contributors: Dict[str, Dict], token: str = "ASM") -> Dict[str, Dict]:
    """Return payout ledger based on loyalty tier, engagement and behavior.

    Parameters
    ----------
    contributors : dict
        Mapping of ``user_id`` -> {"wallet": str, "engagement": int, "behavior": list[str]}
    token : str
        Currency for payouts. Must be one of ASM, ETH or USDC.
    """
    if token not in SUPPORTED_TOKENS:
        raise ValueError(f"Unsupported token {token}")

    ledger = {}
    for user_id, info in contributors.items():
        wallet = info.get("wallet")
        if not wallet:
            continue
        loyalty = loyalty_score(user_id)
        tier_score = loyalty.get("score", 0)
        engagement = info.get("engagement", 0)
        behavior_score = len(info.get("behavior", []))

        # Weighted yield computation
        yield_amount = 0.5 * tier_score + 0.3 * engagement + 0.2 * behavior_score
        if yield_amount <= 0:
            continue

        send_token(wallet, yield_amount, token)
        ledger[wallet] = {"amount": yield_amount, "currency": token}

    total = sum(v["amount"] for v in ledger.values())
    retro_total = total * RETRO_REWARD_PERCENT
    og_wallets = [w for w in _load_json(OG_LIST_PATH, []) if w]
    retro_distribution = []
    if og_wallets and retro_total > 0:
        per_wallet = retro_total / len(og_wallets)
        for wallet in og_wallets:
            send_token(wallet, per_wallet, token)
            retro_distribution.append({"wallet": wallet, "amount": per_wallet, "token": token})

    _update_sim_ledger(ledger)
    return {"rewards": ledger, "retro_rewards": retro_distribution}


def _update_sim_ledger(entries: Dict[str, Dict]) -> None:
    log = _load_json(LEDGER_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    for wallet, data in entries.items():
        log.append({"timestamp": timestamp, "wallet": wallet, **data})
    _write_json(LEDGER_PATH, log)


# ---------------------------------------------------------------------------


def _cli():
    import argparse

    parser = argparse.ArgumentParser(description="Simulate passive yield payouts")
    parser.add_argument("--data", required=True, help="JSON file of contributor data")
    parser.add_argument("--token", choices=sorted(SUPPORTED_TOKENS), default="ASM", help="Payout currency")
    args = parser.parse_args()

    data = _load_json(Path(args.data), {})
    ledger = simulate_passive_yield(data, args.token)
    print(json.dumps(ledger, indent=2))


if __name__ == "__main__":
    _cli()
