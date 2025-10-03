import json
from pathlib import Path
from datetime import datetime, timedelta

BASE_DIR = Path(__file__).resolve().parents[1]
SCORES_PATH = BASE_DIR / "ghostscores.json"
VALUES_PATH = BASE_DIR / "vaultfire-core" / "ghostscore_values.json"

DEFAULT_VALUES = {
    "belief_sync": 10,
    "partner_activation": 25,
    "yield_claim": 5,
    "decay_per_week": 1,
}


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


def _values() -> dict:
    return _load_json(VALUES_PATH, DEFAULT_VALUES)


def _apply_decay(info: dict, decay_per_week: int) -> dict:
    last = info.get("last_update")
    if not last:
        info["last_update"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        return info
    try:
        last_dt = datetime.strptime(last, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        info["last_update"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        return info
    now = datetime.utcnow()
    weeks = (now - last_dt).days // 7
    if weeks > 0 and decay_per_week > 0:
        info["score"] = max(0, info.get("score", 0) - weeks * decay_per_week)
        last_dt += timedelta(weeks=weeks)
    info["last_update"] = last_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return info


def _record_action(ens: str, action: str) -> int:
    values = _values()
    state = _load_json(SCORES_PATH, {})
    key = ens.lower()
    info = state.get(key, {"score": 0})
    info = _apply_decay(info, values.get("decay_per_week", 0))
    xp = values.get(action, 0)
    info["score"] = info.get("score", 0) + xp
    info["last_update"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    state[key] = info
    _write_json(SCORES_PATH, state)
    return int(info["score"])


def record_belief_sync(ens: str) -> int:
    return _record_action(ens, "belief_sync")


def record_partner_activation(ens: str) -> int:
    return _record_action(ens, "partner_activation")


def record_yield_claim(ens: str) -> int:
    return _record_action(ens, "yield_claim")


def get_ghostscore(ens: str) -> int:
    state = _load_json(SCORES_PATH, {})
    key = ens.lower()
    info = state.get(key)
    if not info:
        return 0
    values = _values()
    info = _apply_decay(info, values.get("decay_per_week", 0))
    state[key] = info
    _write_json(SCORES_PATH, state)
    return int(info.get("score", 0))


def ghostscore_handoff(user_id: str) -> dict:
    """Compare sandbox and production multipliers for ``user_id``.

    The handoff validates that a pilot's ghostscore-driven multiplier carries over
    from sandbox evaluations into production readiness without drift. The output
    records both multiplier contexts alongside a stability signal so partners can
    audit the transition when they graduate from mission-aligned pilots.
    """

    from .belief_multiplier import belief_multiplier

    sandbox_multiplier, sandbox_tier = belief_multiplier(user_id, sandbox_mode=True)
    production_multiplier, production_tier = belief_multiplier(user_id, sandbox_mode=False)
    score = get_ghostscore(user_id)
    carryover_delta = round(production_multiplier - sandbox_multiplier, 5)
    carryover_stable = abs(carryover_delta) <= 0.0005

    return {
        "user_id": user_id,
        "ghostscore": score,
        "sandbox": {
            "multiplier": sandbox_multiplier,
            "tier": sandbox_tier,
        },
        "production": {
            "multiplier": production_multiplier,
            "tier": production_tier,
        },
        "carryover_delta": carryover_delta,
        "carryover_stable": carryover_stable,
    }


__all__ = [
    "record_belief_sync",
    "record_partner_activation",
    "record_yield_claim",
    "get_ghostscore",
    "ghostscore_handoff",
]
