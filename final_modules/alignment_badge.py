"""Proof-of-Alignment Badge System.

Generates simple badge records for users and partners who follow the
Ghostkey Ethics Framework. Badges are stored as JSON entries and can
be used to unlock perks in the wider ecosystem.
"""
from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime

BADGE_PATH = Path(__file__).resolve().parent / "badges.json"


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


def issue_badge(user_id: str, tier: str) -> dict:
    badges = _load_json(BADGE_PATH, {})
    badge = {
        "tier": tier,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    badges[user_id] = badge
    _write_json(BADGE_PATH, badges)
    return badge


__all__ = ["issue_badge"]
