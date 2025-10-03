"""Belief multiplier calculations for Vaultfire v1.13."""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Tuple

BASE_DIR = Path(__file__).resolve().parents[1]
SCORE_PATH = BASE_DIR / "belief_score.json"
TIER_NAMES = ("Spark", "Glow", "Burner", "Immortal Flame")
SANDBOX_ENV_FLAG = os.getenv("VAULTFIRE_SANDBOX_MODE", "").lower() in {"1", "true", "yes", "on"}
SANDBOX_CONFIG_PATH = BASE_DIR / "configs" / "module_sandbox.json"
DEFAULT_SANDBOX_LOG_PATH = BASE_DIR / "logs" / "belief-sandbox.json"
SANDBOX_CONFIG_FLAG = False
SANDBOX_LOG_PATH = DEFAULT_SANDBOX_LOG_PATH
ANNUAL_WALLET_EVENT_CAPACITY = 10_000_000

TIER_RULES = (
    {"threshold": 100, "tier": TIER_NAMES[3], "multiplier": 1.2},
    {"threshold": 50, "tier": TIER_NAMES[2], "multiplier": 1.1},
    {"threshold": 20, "tier": TIER_NAMES[1], "multiplier": 1.05},
    {"threshold": 0, "tier": TIER_NAMES[0], "multiplier": 1.0},
)


def _collision_map() -> Dict[float, list[str]]:
    collisions: Dict[float, list[str]] = {}
    for rule in TIER_RULES:
        mult = rule["multiplier"]
        collisions.setdefault(mult, []).append(rule["tier"])
    return collisions


MULTIPLIER_COLLISIONS = _collision_map()


def _resolve_log_path(value: str | None) -> Path:
    if not value:
        return DEFAULT_SANDBOX_LOG_PATH
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = (BASE_DIR / candidate).resolve()
    return candidate


def _log_sandbox_metrics(entry: dict) -> None:
    try:
        SANDBOX_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with SANDBOX_LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry) + "\n")
    except OSError:
        # Sandbox logging is best-effort and must not interrupt scoring.
        pass


def _resolve_collision(tier: str, multiplier: float) -> Tuple[float, bool]:
    tiers = MULTIPLIER_COLLISIONS.get(multiplier, [])
    if len(tiers) <= 1:
        return multiplier, False
    try:
        index = tiers.index(tier)
    except ValueError:
        index = 0
    # Provide a small deterministic offset to keep ordering consistent.
    adjusted = round(multiplier + (index + 1) * 0.0005, 5)
    return adjusted, True


def _load_json(path: Path) -> dict:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _load_sandbox_config() -> None:
    global SANDBOX_CONFIG_FLAG, SANDBOX_LOG_PATH
    config = _load_json(SANDBOX_CONFIG_PATH)
    settings = config.get("belief-mechanics", {}) if isinstance(config, dict) else {}
    SANDBOX_CONFIG_FLAG = bool(settings.get("sandbox_mode"))
    SANDBOX_LOG_PATH = _resolve_log_path(settings.get("log_path"))


_load_sandbox_config()


def record_belief_action(user_id: str, action: str) -> None:
    """Update ``belief_score.json`` with ``action`` for ``user_id``."""
    data = _load_json(SCORE_PATH)
    info = data.get(
        user_id,
        {"interactions": 0, "growth_events": 0, "milestones": 0, "flames": 0},
    )
    if action == "interaction":
        info["interactions"] += 1
    elif action == "growth":
        info["growth_events"] += 1
    elif action == "milestone":
        info["milestones"] += 1
    elif action == "flame":
        info["flames"] += 1
    data[user_id] = info
    _write_json(SCORE_PATH, data)


def _score(info: dict) -> int:
    return (
        info.get("interactions", 0)
        + info.get("growth_events", 0) * 2
        + info.get("milestones", 0) * 5
        + info.get("flames", 0) * 10
    )


def belief_multiplier(user_id: str, *, sandbox_mode: bool | None = None) -> Tuple[float, str]:
    """Return ``(multiplier, tier)`` for ``user_id``.

    When ``sandbox_mode`` is enabled (explicitly or via ``VAULTFIRE_SANDBOX_MODE``)
    metrics are streamed to ``logs/belief-sandbox.json`` so partner sandboxes can
    verify the scoring heuristics without mutating production data.
    """
    data = _load_json(SCORE_PATH)
    info = data.get(user_id, {})
    total = _score(info)
    for rule in TIER_RULES:
        if total >= rule["threshold"]:
            tier = rule["tier"]
            base_multiplier = rule["multiplier"]
            break
    else:  # pragma: no cover - defensive, should never hit due to zero rule
        tier = TIER_NAMES[0]
        base_multiplier = 1.0

    multiplier, collision_resolved = _resolve_collision(tier, base_multiplier)

    base_sandbox = SANDBOX_ENV_FLAG or SANDBOX_CONFIG_FLAG
    active_sandbox = base_sandbox if sandbox_mode is None else bool(sandbox_mode)
    if active_sandbox:
        entry = {
            "source": "belief_multiplier",
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "score_total": total,
            "tier": tier,
            "base_multiplier": base_multiplier,
            "multiplier": multiplier,
            "collisionResolved": collision_resolved,
            "annualWalletEventCapacity": ANNUAL_WALLET_EVENT_CAPACITY,
        }
        _log_sandbox_metrics(entry)

    return multiplier, tier


def multiplier_capacity_plan() -> dict:
    """Return scale assumptions for audit dashboards."""

    return {
        "annual_wallet_event_capacity": ANNUAL_WALLET_EVENT_CAPACITY,
        "tiers": [
            {"name": rule["tier"], "threshold": rule["threshold"], "multiplier": rule["multiplier"]}
            for rule in TIER_RULES
        ],
    }


__all__ = ["record_belief_action", "belief_multiplier", "multiplier_capacity_plan"]
