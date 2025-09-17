"""Retail Revival Mode optional feature layer."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

try:  # optional during lightweight test environments
    from engine.loyalty_engine import update_loyalty_ranks
except Exception:  # pragma: no cover - best effort fallback
    def update_loyalty_ranks() -> List[Dict[str, Any]]:
        return []

try:  # optional during lightweight test environments
    from engine.purpose_engine import moral_memory_mirror
except Exception:  # pragma: no cover - best effort fallback
    def moral_memory_mirror(user_id: str) -> Dict[str, Any]:
        return {"user_id": user_id, "fingerprint": "", "alignment_avg": 0.0}

from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parent
CFG_PATH = BASE_DIR / "retail_revival_config.json"
VISITS_PATH = BASE_DIR / "retail_revival_visits.json"

NOSTALGIA_THEMES = {
    "mall_90s": {"overlay": "🛍️ Neon lights and food court jams"},
    "game_shop": {"overlay": "🎮 Cartridge cabinets and pixel art banners"},
}




def set_retail_revival_enabled(partner_id: str, enabled: bool) -> None:
    """Toggle Retail Revival Mode for ``partner_id``."""
    cfg = load_json(CFG_PATH, {})
    cfg[partner_id] = bool(enabled)
    write_json(CFG_PATH, cfg)


def retail_revival_enabled(partner_id: str) -> bool:
    """Return True if Retail Revival Mode is active for ``partner_id``."""
    cfg = load_json(CFG_PATH, {})
    return cfg.get(partner_id, False)


def offline_prompt(message: str) -> str:
    """Return a minimal text block for analog-style displays."""
    border = "-" * 32
    return f"\n{border}\n{message}\n{border}\n"


def nostalgia_overlay(theme: str) -> dict:
    """Return theme overlay details."""
    return NOSTALGIA_THEMES.get(theme, {})


def retail_story_snippet(theme: str, context: str) -> str:
    """Generate a short narrative snippet for retail staff."""
    overlay = nostalgia_overlay(theme).get("overlay", "")
    return f"{overlay} {context}".strip()


def record_visit(user_id: str, partner_id: str, theme: str | None = None) -> dict:
    """Record a physical visit and sync loyalty and memory."""
    if not retail_revival_enabled(partner_id):
        return {"message": "retail revival inactive"}
    visits = load_json(VISITS_PATH, {})
    history = visits.get(user_id, [])
    entry = {
        "partner": partner_id,
        "theme": theme or "default",
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    history.append(entry)
    visits[user_id] = history
    write_json(VISITS_PATH, visits)
    moral_memory_mirror(user_id)
    update_loyalty_ranks()
    return entry


def visit_history(user_id: str) -> list:
    """Return logged visit history."""
    visits = load_json(VISITS_PATH, {})
    return visits.get(user_id, [])


__all__ = [
    "set_retail_revival_enabled",
    "retail_revival_enabled",
    "offline_prompt",
    "nostalgia_overlay",
    "retail_story_snippet",
    "record_visit",
    "visit_history",
]

