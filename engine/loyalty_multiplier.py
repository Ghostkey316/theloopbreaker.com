import json
import os
from datetime import datetime
from pathlib import Path

from .loyalty_engine import loyalty_score
from .wallet_loyalty import loyalty_multiplier as wallet_multiplier
from .contributor_xp import xp_score

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
CONFIG_PATH = BASE_DIR / "vault_config.json"
SANDBOX_CONFIG_PATH = BASE_DIR / "configs" / "module_sandbox.json"
DEFAULT_SANDBOX_LOG_PATH = BASE_DIR / "logs" / "belief-sandbox.json"
SANDBOX_LOG_PATH = DEFAULT_SANDBOX_LOG_PATH
SANDBOX_CONFIG_FLAG = False
SANDBOX_ENV_FLAG = os.getenv("VAULTFIRE_SANDBOX_MODE", "").lower() in {"1", "true", "yes", "on"}


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _resolve_log_path(value: str | None) -> Path:
    if not value:
        return DEFAULT_SANDBOX_LOG_PATH
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = (BASE_DIR / candidate).resolve()
    return candidate


def _load_sandbox_config() -> None:
    global SANDBOX_CONFIG_FLAG, SANDBOX_LOG_PATH
    config = _load_json(SANDBOX_CONFIG_PATH, {})
    settings = config.get("multiplier-core", {}) if isinstance(config, dict) else {}
    SANDBOX_CONFIG_FLAG = bool(settings.get("sandbox_mode"))
    SANDBOX_LOG_PATH = _resolve_log_path(settings.get("log_path"))


def _sandbox_log(entry: dict) -> None:
    try:
        SANDBOX_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with SANDBOX_LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry) + "\n")
    except OSError:
        pass


_load_sandbox_config()


def loyalty_multiplier(user_id: str) -> float:
    """Return combined loyalty multiplier for ``user_id``."""
    cfg = _load_json(CONFIG_PATH, {})
    base_sandbox = SANDBOX_ENV_FLAG or SANDBOX_CONFIG_FLAG
    multiplier_enabled = cfg.get("multiplier_boosts_enabled", True)

    scorecard = _load_json(SCORECARD_PATH, {})
    wallet = scorecard.get(user_id, {}).get("wallet")
    loyalty = loyalty_score(user_id, sandbox_mode=base_sandbox)
    base_mult = 1.0
    base = loyalty.get("base", 0)
    if base:
        score_value = loyalty.get("score", 0)
        base_mult = score_value / base if base else 1.0
    wallet_mult = 1.0
    if wallet:
        try:
            wallet_mult = wallet_multiplier(wallet)
        except Exception:
            wallet_mult = 1.0
    xp_val = xp_score(user_id)["xp"]
    xp_mult = 1 + xp_val / 1000

    combined = base_mult * wallet_mult * xp_mult if multiplier_enabled else 1.0
    result = round(combined, 3)

    if base_sandbox:
        _sandbox_log(
            {
                "source": "multiplier_core.compute",
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id,
                "baseMultiplier": round(base_mult, 6),
                "walletMultiplier": round(wallet_mult, 6),
                "xpMultiplier": round(xp_mult, 6),
                "multiplierEnabled": bool(multiplier_enabled),
                "result": result,
            }
        )

    return result
