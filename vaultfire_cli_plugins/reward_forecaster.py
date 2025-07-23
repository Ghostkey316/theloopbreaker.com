import argparse
import json
from pathlib import Path

from engine.identity_resolver import resolve_identity
from engine.contributor_xp import xp_score
from engine.loyalty_multiplier import loyalty_multiplier
from engine.loyalty_engine import loyalty_score
from engine.wallet_loyalty import wallet_tier

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _find_user(wallet: str) -> str | None:
    """Return user_id for ``wallet`` if found in scorecard."""
    scorecard = _load_json(SCORECARD_PATH, {})
    resolved = resolve_identity(wallet) or wallet
    for uid, data in scorecard.items():
        w = data.get("wallet", "")
        if w == wallet or resolve_identity(w) == resolved:
            return uid
    return None


def _forecast_tier(score: float) -> str:
    if score >= 300:
        return "legend"
    if score >= 150:
        return "veteran"
    if score >= 50:
        return "origin"
    return "default"


def _run(args: argparse.Namespace) -> None:
    wallet = args.wallet
    user = _find_user(wallet)
    resolved = resolve_identity(wallet) or wallet
    if user is None:
        tier = wallet_tier(resolved)
        output = {
            "wallet": wallet,
            "resolved_wallet": resolved,
            "linked": False,
            "loyalty_tier": tier,
            "contribution_score": 0,
            "forecast_tier": tier,
        }
    else:
        xp_info = xp_score(user)
        loyalty_info = loyalty_score(user)
        behavior_mult = loyalty_multiplier(user)
        current = loyalty_info.get("score", 0)
        future_score = current + xp_info.get("xp", 0) * behavior_mult
        output = {
            "wallet": wallet,
            "resolved_wallet": resolved,
            "linked": True,
            "user_id": user,
            "current_tier": loyalty_info.get("tier"),
            "behavior_multiplier": behavior_mult,
            "contribution_score": xp_info.get("xp", 0),
            "forecast_tier": _forecast_tier(future_score),
        }
    print(json.dumps(output, indent=2))


def register(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "forecast-rewards", help="Forecast weekly rewards for a wallet"
    )
    parser.add_argument("--wallet", required=True, help="Wallet address or ENS")
    parser.set_defaults(func=_run)

