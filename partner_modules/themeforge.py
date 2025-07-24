from __future__ import annotations

"""Partner branding layer."""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
THEME_PATH = BASE_DIR / "dashboards" / "partner_themes.json"


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


def _ethics_check(text: str) -> bool:
    banned = ["scam", "hate", "manipulation"]
    return not any(b in text.lower() for b in banned)


def set_theme(partner_id: str, theme: dict) -> None:
    """Store branding theme after ethics validation."""
    name = theme.get("name", "")
    if not _ethics_check(name):
        raise ValueError("theme name violates ethics")
    cfg = _load_json(THEME_PATH, {})
    cfg[partner_id] = theme
    _write_json(THEME_PATH, cfg)


def preview_theme(partner_id: str) -> dict:
    """Return stored theme configuration."""
    cfg = _load_json(THEME_PATH, {})
    return cfg.get(partner_id, {})
