# Reference: ethics/core.mdx
"""Partner integration hooks for token-based usage."""

from datetime import datetime
import json
from pathlib import Path

from .token_ops import send_token
from .activation_gate import enforce_activation
from .immutable_log import append_entry

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
USAGE_LOG_PATH = BASE_DIR / "logs" / "partner_usage.json"


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


def _load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def _check_enabled():
    enforce_activation()
    config = _load_config()
    if not config.get("ethics_anchor", False):
        raise RuntimeError("Ethics anchor disabled. Monetization halted.")
    if not config.get("partner_hooks_enabled", False):
        raise RuntimeError("Partner hooks disabled in configuration.")


# ---------------------------------------------------------------------------

def record_usage(partner_id: str, feature: str, tokens: float, wallet: str,
                 token: str = "ASM") -> dict:
    """Record ``tokens`` consumed by ``partner_id`` for ``feature``.

    A negative token amount is stored in ``token_ledger.json`` to denote
    a deduction from the partner's wallet.
    """
    _check_enabled()
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "partner_id": partner_id,
        "feature": feature,
        "wallet": wallet,
        "token": token,
        "tokens_used": tokens,
    }
    log = _load_json(USAGE_LOG_PATH, [])
    log.append(entry)
    _write_json(USAGE_LOG_PATH, log)
    # Deduct tokens by recording a negative ledger entry
    send_token(wallet, -tokens, token)
    append_entry("partner_usage", entry)
    return entry


def grant_reward(partner_id: str, wallet: str, amount: float,
                 token: str = "ASM") -> dict:
    """Grant ``amount`` tokens to ``partner_id``."""
    _check_enabled()
    send_token(wallet, amount, token)
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "partner_id": partner_id,
        "wallet": wallet,
        "token": token,
        "reward": amount,
    }
    log = _load_json(USAGE_LOG_PATH, [])
    log.append(entry)
    _write_json(USAGE_LOG_PATH, log)
    append_entry("partner_reward", entry)
    return entry
