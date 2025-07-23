"""Planetkeeper Module for eco-linked rewards."""
from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "logs" / "planetkeeper"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
OPT_IN_PATH = DATA_DIR / "opt_in.json"
ACTION_PATH = DATA_DIR / "eco_actions.json"
IMPACT_PATH = BASE_DIR / "dashboards" / "planetkeeper_public.json"


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


# ---------------------------------------------------------------------------
# Opt-in management
# ---------------------------------------------------------------------------

def opt_in(user_id: str) -> None:
    """Enable Planetkeeper tracking for ``user_id``."""
    data = _load_json(OPT_IN_PATH, [])
    if user_id not in data:
        data.append(user_id)
        _write_json(OPT_IN_PATH, data)


def is_opted_in(user_id: str) -> bool:
    """Return ``True`` if ``user_id`` opted in."""
    return user_id in _load_json(OPT_IN_PATH, [])


# ---------------------------------------------------------------------------
# Action logging and multipliers
# ---------------------------------------------------------------------------

def record_eco_action(user_id: str, action: str, details: Optional[Dict] = None) -> None:
    """Record an eco-positive ``action`` for ``user_id``."""
    if not is_opted_in(user_id):
        return
    data = _load_json(ACTION_PATH, {})
    log = data.get(user_id, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "action": action,
    }
    if details:
        entry["details"] = details
    log.append(entry)
    data[user_id] = log[-50:]
    _write_json(ACTION_PATH, data)
    _update_public(user_id)


def _update_public(user_id: str) -> None:
    dash = _load_json(IMPACT_PATH, {})
    dash[user_id] = dash.get(user_id, 0) + 1
    _write_json(IMPACT_PATH, dash)


def eco_score(user_id: str) -> int:
    """Return raw eco action count for ``user_id``."""
    return len(_load_json(ACTION_PATH, {}).get(user_id, []))


def eco_multiplier(user_id: str) -> float:
    """Return yield multiplier based on eco score."""
    score = eco_score(user_id)
    mult = 1.0 + min(score, 100) / 100.0
    return round(mult, 2)


# ---------------------------------------------------------------------------
# Badges and public impact
# ---------------------------------------------------------------------------

def award_planetkeeper_badge(user_id: str) -> None:
    """Add Planetkeeper badge to ``user_id`` if opted in."""
    if not is_opted_in(user_id):
        return
    scorecard = _load_json(SCORECARD_PATH, {})
    user = scorecard.get(user_id, {})
    badges = set(user.get("badges", []))
    badges.add("planetkeeper")
    user["badges"] = sorted(badges)
    scorecard[user_id] = user
    _write_json(SCORECARD_PATH, scorecard)


def public_impact() -> Dict[str, int]:
    """Return summarized eco actions per user."""
    return _load_json(IMPACT_PATH, {})


# ---------------------------------------------------------------------------
# Optional external API stubs
# ---------------------------------------------------------------------------

def carbon_offset_status(user_id: str) -> Dict:
    """Placeholder for carbon offset API integration."""
    return {"user_id": user_id, "offset_tons": 0.0}


def energy_device_report(user_id: str) -> Dict:
    """Placeholder for efficient device detection API."""
    return {"user_id": user_id, "efficient_devices": []}


def pledge_commitment(user_id: str, pledge: str) -> None:
    """Record sustainability pledge text."""
    record_eco_action(user_id, "pledge", {"pledge": pledge})


__all__ = [
    "opt_in",
    "is_opted_in",
    "record_eco_action",
    "eco_score",
    "eco_multiplier",
    "award_planetkeeper_badge",
    "public_impact",
    "carbon_offset_status",
    "energy_device_report",
    "pledge_commitment",
]
