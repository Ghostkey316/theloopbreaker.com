# Reference: ethics/core.mdx
import json
import os
from datetime import datetime
from pathlib import Path

from .marketplace import currency_allowed
from .wallet_loyalty import update_wallet_loyalty
from .activation_gate import enforce_activation
from .immutable_log import append_entry

BASE_DIR = Path(__file__).resolve().parents[1]
LEDGER_PATH = BASE_DIR / "logs" / "token_ledger.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    os.makedirs(path.parent, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def send_token(wallet: str, amount: float, token: str) -> None:
    """Record a token transfer to ``wallet`` if ``token`` is allowed.

    Raises ``RuntimeError`` if the protocol is halted.
    """
    enforce_activation()
    if not currency_allowed(token):
        raise ValueError(f"Token {token} not supported by marketplace")
    ledger = _load_json(LEDGER_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "wallet": wallet,
        "amount": amount,
        "token": token,
    }
    ledger.append(entry)
    _write_json(LEDGER_PATH, ledger)
    try:
        update_wallet_loyalty(wallet, amount)
    except Exception:
        pass
    append_entry("token_transfer", entry)
    return None
