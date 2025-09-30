# Reference: ethics/core.mdx
"""Loyalty Engine with tiered behavior multipliers."""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from . import storage

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
VALUES_PATH = BASE_DIR / "vaultfire-core" / "ghostkey_values.json"
LOYALTY_RANKS_PATH = BASE_DIR / "dashboards" / "loyalty_ranks.json"
LOG_PATH = BASE_DIR / "logs" / "loyalty_engine_log.json"
SANDBOX_CONFIG_PATH = BASE_DIR / "configs" / "module_sandbox.json"
DEFAULT_SANDBOX_LOG_PATH = BASE_DIR / "logs" / "belief-sandbox.json"
SANDBOX_LOG_PATH = DEFAULT_SANDBOX_LOG_PATH
SANDBOX_CONFIG_FLAG = False
SANDBOX_ENV_FLAG = os.getenv("VAULTFIRE_SANDBOX_MODE", "").lower() in {"1", "true", "yes", "on"}


def _load_json(path: Path, default):
    return storage.load_data(path, default)


def _write_json(path: Path, data) -> None:
    storage.write_data(path, data)


def _log(entry: dict) -> None:
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    entry_with_time = {"timestamp": timestamp, **entry}
    storage.append_log(LOG_PATH, entry_with_time)


def _resolve_log_path(value: str | None) -> Path:
    if not value:
        return DEFAULT_SANDBOX_LOG_PATH
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = (BASE_DIR / candidate).resolve()
    return candidate


def _tier_multiplier(tier: str) -> tuple[float, bool]:
    values = _load_json(VALUES_PATH, {})
    multipliers = values.get("loyalty_multipliers", {})
    base = multipliers.get(tier, multipliers.get("default", 1.0))
    duplicates = sorted(name for name, value in multipliers.items() if value == base)
    if len(duplicates) <= 1:
        return base, False
    try:
        index = duplicates.index(tier)
    except ValueError:
        index = 0
    adjusted = round(base + (index + 1) * 0.0005, 5)
    return adjusted, True


def _sandbox_log(entry: dict) -> None:
    try:
        SANDBOX_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with SANDBOX_LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry) + "\n")
    except OSError:
        pass


def _load_sandbox_config() -> None:
    global SANDBOX_CONFIG_FLAG, SANDBOX_LOG_PATH
    config = storage.load_data(SANDBOX_CONFIG_PATH, {})
    settings = config.get("loyalty-engine", {}) if isinstance(config, dict) else {}
    SANDBOX_CONFIG_FLAG = bool(settings.get("sandbox_mode"))
    SANDBOX_LOG_PATH = _resolve_log_path(settings.get("log_path"))


_load_sandbox_config()


def _determine_tier(points: float) -> str:
    if points >= 300:
        return "legend"
    if points >= 150:
        return "veteran"
    if points >= 50:
        return "origin"
    return "default"


def loyalty_score(user_id: str, *, sandbox_mode: bool | None = None) -> dict:
    scorecard = _load_json(SCORECARD_PATH, {})
    data = scorecard.get(user_id, {})
    base = data.get("loyalty", 0)
    tier = _determine_tier(base)
    multiplier, collision_resolved = _tier_multiplier(tier)
    wallet = data.get("wallet")
    bond_mult = 1.0
    if wallet:
        try:
            from .wallet_bonding import bond_multiplier
            bond_mult = bond_multiplier(wallet)
        except Exception:
            pass
    score = base * multiplier * bond_mult
    result = {
        "user_id": user_id,
        "base": base,
        "tier": tier,
        "score": score,
        "collisionResolved": collision_resolved,
        "multiplier": multiplier,
    }

    base_sandbox = SANDBOX_ENV_FLAG or SANDBOX_CONFIG_FLAG
    active_sandbox = base_sandbox if sandbox_mode is None else bool(sandbox_mode)
    if active_sandbox:
        _sandbox_log(
            {
                "source": "loyalty_engine.score",
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id,
                "tier": tier,
                "base": base,
                "bondMultiplier": bond_mult,
                "multiplier": multiplier,
                "score": score,
                "collisionResolved": collision_resolved,
            }
        )

    return result


def loyalty_enhanced_score(
    user_id: str,
    mood: Optional[int] = None,
    frequency: Optional[int] = None,
    life_impact: Optional[float] = None,
    *,
    sandbox_mode: bool | None = None,
) -> dict:
    """Return loyalty score adjusted by mood and impact metrics."""
    info = loyalty_score(user_id, sandbox_mode=sandbox_mode)
    bonus = 0.0
    if mood is not None:
        bonus += max(min(mood - 3, 2), -2) * 5
    if frequency is not None:
        bonus += min(frequency, 30) * 0.2
    if life_impact is not None:
        bonus += life_impact * 10
    info["score"] += bonus
    info["bonus"] = bonus

    base_sandbox = SANDBOX_ENV_FLAG or SANDBOX_CONFIG_FLAG
    active_sandbox = base_sandbox if sandbox_mode is None else bool(sandbox_mode)
    if active_sandbox:
        _sandbox_log(
            {
                "source": "loyalty_engine.enhanced",
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id,
                "bonus": bonus,
                "mood": mood,
                "frequency": frequency,
                "lifeImpact": life_impact,
                "score": info["score"],
            }
        )

    return info


def update_loyalty_ranks(*, sandbox_mode: bool | None = None) -> list[dict]:
    scorecard = _load_json(SCORECARD_PATH, {})
    ranks = [loyalty_score(uid, sandbox_mode=sandbox_mode) for uid in scorecard.keys()]
    ranks.sort(key=lambda x: x["score"], reverse=True)
    _write_json(LOYALTY_RANKS_PATH, ranks)
    _log({"action": "update_ranks", "count": len(ranks)})

    base_sandbox = SANDBOX_ENV_FLAG or SANDBOX_CONFIG_FLAG
    active_sandbox = base_sandbox if sandbox_mode is None else bool(sandbox_mode)
    if active_sandbox:
        _sandbox_log(
            {
                "source": "loyalty_engine.ranks",
                "timestamp": datetime.utcnow().isoformat(),
                "count": len(ranks),
                "top": ranks[:5],
            }
        )

    return ranks


__all__ = [
    "loyalty_score",
    "update_loyalty_ranks",
    "loyalty_enhanced_score",
]


if __name__ == "__main__":
    update_loyalty_ranks()
