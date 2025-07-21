import json
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
STATE_PATH = BASE_DIR / "logs" / "wallet_loyalty_state.json"
VALUES_PATH = BASE_DIR / "vaultfire-core" / "ghostkey_values.json"


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


def _state() -> dict:
    return _load_json(STATE_PATH, {})


def _save_state(state: dict) -> None:
    _write_json(STATE_PATH, state)


def update_wallet_loyalty(wallet: str, amount: float) -> None:
    """Update wallet balance and reset loyalty on major sell offs."""
    state = _state()
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    info = state.get(wallet, {"balance": 0.0, "start_time": now})
    prev_balance = info.get("balance", 0.0)
    new_balance = prev_balance + amount

    if amount < 0 and prev_balance > 0 and abs(amount) >= 0.9 * prev_balance:
        # selling majority of holdings resets loyalty
        info["start_time"] = now
    info["balance"] = new_balance
    state[wallet] = info
    _save_state(state)


def _determine_tier(start_time: str) -> str:
    if not start_time:
        return "default"
    try:
        start = datetime.strptime(start_time, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return "default"
    elapsed = datetime.utcnow() - start
    if elapsed >= timedelta(weeks=8):
        return "ghost"
    if elapsed >= timedelta(weeks=4):
        return "fire"
    if elapsed >= timedelta(weeks=2):
        return "signal"
    if elapsed >= timedelta(weeks=1):
        return "spark"
    return "default"


def wallet_tier(wallet: str) -> str:
    state = _state()
    info = state.get(wallet)
    if not info:
        return "default"
    return _determine_tier(info.get("start_time"))


def loyalty_multiplier(wallet: str) -> float:
    tier = wallet_tier(wallet)
    values = _load_json(VALUES_PATH, {})
    mults = values.get("loyalty_multipliers", {})
    mult = mults.get(tier, mults.get("default", 1.0))
    try:
        from .wallet_bonding import bond_multiplier
        mult *= bond_multiplier(wallet)
    except Exception:
        pass
    return mult
