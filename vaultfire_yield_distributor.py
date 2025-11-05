"""Yield distributor CLI for Vaultfire.

This script triggers yield drops for specific actions. A base payout amount is
assigned to each ``action_type`` and multiplied by the caller's Ghostscore
(reputation). The payout is sent in ASM, ETH or USDC. Use ``--dry-run`` to
simulate without persisting changes.

Ready for integration with partner activation and belief alignment modules.
"""

from __future__ import annotations

import argparse
import json
from typing import Tuple

from engine.token_ops import send_token
from engine.marketplace import currency_allowed
from engine.ghostscore_engine import (
    get_ghostscore,
    record_belief_sync,
    record_partner_activation,
    record_yield_claim,
)

from drift_oracle import DriftOracle


SUPPORTED_TOKENS = {"ASM", "ETH", "USDC"}

# Base payout amounts for each allowed action type
BASE_PAYOUTS = {
    "belief_sync": 2.0,
    "partner_activation": 5.0,
    "yield_claim": 1.0,
}


DRIFT_ORACLE = DriftOracle.from_belief_log()


def _payout_for_action(ens: str, action: str) -> Tuple[float, float, int]:
    """Return (amount, multiplier, score) for ``action`` and ``ens``."""
    score = get_ghostscore(ens)
    multiplier = 1 + score / 100
    base = BASE_PAYOUTS.get(action, 1.0)
    return base * multiplier, multiplier, score


def trigger_yield_drop(
    ens: str,
    wallet: str,
    action_type: str,
    token: str = "ASM",
    dry_run: bool = False,
) -> dict:
    """Execute or simulate a yield drop and return details."""
    if token not in SUPPORTED_TOKENS or not currency_allowed(token):
        raise ValueError(f"Token {token} not supported")

    amount, multiplier, score = _payout_for_action(ens, action_type)
    base_value = BASE_PAYOUTS.get(action_type, 1.0)
    try:
        projection = DRIFT_ORACLE.project(base_amount=base_value)
    except ValueError as exc:
        return {
            "ens": ens,
            "wallet": wallet,
            "action": action_type,
            "token": token,
            "base_payout": base_value,
            "ghostscore": score,
            "multiplier": round(multiplier, 3),
            "amount": amount,
            "dry_run": dry_run,
            "status": "blocked",
            "reason": str(exc),
        }
    result = {
        "ens": ens,
        "wallet": wallet,
        "action": action_type,
        "token": token,
        "base_payout": base_value,
        "ghostscore": score,
        "multiplier": round(multiplier, 3),
        "amount": amount,
        "dry_run": dry_run,
        "drift_projection": {
            "expected_yield": round(projection.expected_yield, 6),
            "drift_ratio": round(projection.drift_ratio, 6),
            "alignment_score": round(projection.alignment_score, 6),
        },
        "attestation": projection.attestation,
    }

    if not dry_run:
        send_token(wallet, amount, token)
        if action_type == "yield_claim":
            record_yield_claim(ens)
        elif action_type == "partner_activation":
            record_partner_activation(ens)
        elif action_type == "belief_sync":
            record_belief_sync(ens)
        result["status"] = "sent"
    else:
        result["status"] = "simulated"

    return result


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Trigger a Vaultfire yield drop")
    parser.add_argument("ens", help="ENS name")
    parser.add_argument("wallet", help="wallet address or ENS")
    parser.add_argument("action_type", choices=sorted(BASE_PAYOUTS.keys()))
    parser.add_argument(
        "--token",
        choices=sorted(SUPPORTED_TOKENS),
        default="ASM",
        help="payout currency",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="simulate without sending tokens",
    )

    args = parser.parse_args(argv)
    data = trigger_yield_drop(
        args.ens, args.wallet, args.action_type, args.token, args.dry_run
    )
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
