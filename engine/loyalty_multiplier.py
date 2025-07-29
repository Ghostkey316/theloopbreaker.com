import json
from pathlib import Path

from .loyalty_engine import loyalty_score
from .wallet_loyalty import loyalty_multiplier as wallet_multiplier
from .contributor_xp import xp_score

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
CONFIG_PATH = BASE_DIR / "vault_config.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def loyalty_multiplier(user_id: str) -> float:
    """Return combined loyalty multiplier for ``user_id``."""
    cfg = _load_json(CONFIG_PATH, {})
    if not cfg.get("multiplier_boosts_enabled", True):
        return 1.0
    scorecard = _load_json(SCORECARD_PATH, {})
    wallet = scorecard.get(user_id, {}).get("wallet")
    loyalty = loyalty_score(user_id)
    base_mult = 1.0
    base = loyalty.get("base", 0)
    if base:
        base_mult = loyalty.get("score", 0) / base
    wallet_mult = 1.0
    if wallet:
        try:
            wallet_mult = wallet_multiplier(wallet)
        except Exception:
            wallet_mult = 1.0
    xp_val = xp_score(user_id)["xp"]
    xp_mult = 1 + xp_val / 1000
    return round(base_mult * wallet_mult * xp_mult, 3)
