"""BrandKit and Ecosystem Collaboration Portal.

This module auto-generates simple brand assets from system metadata
and allows partners to register protocol links. The generated kit is
stored in ``brandkit.json`` under ``final_modules``.
"""
from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR.parent / "vaultfire-core" / "vaultfire_config.json"
KIT_PATH = BASE_DIR / "brandkit.json"
PORTAL_PATH = BASE_DIR / "ecosystem_links.json"


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


def generate_brandkit() -> dict:
    cfg = _load_json(CONFIG_PATH, {})
    kit = {
        "name": cfg.get("system_name", "Vaultfire"),
        "colors": {
            "primary": "#FF5500",
            "secondary": "#222222",
        },
        "logo": "logo.svg",
        "style_guide": "Follow the ethics-first design language",
        "generated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _write_json(KIT_PATH, kit)
    return kit


def register_partner_link(partner_id: str, url: str) -> None:
    links = _load_json(PORTAL_PATH, {})
    links[partner_id] = url
    _write_json(PORTAL_PATH, links)


__all__ = ["generate_brandkit", "register_partner_link"]
