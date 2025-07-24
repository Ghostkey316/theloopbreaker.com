from __future__ import annotations

"""Configuration toggles for partner add-ons."""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
CFG_PATH = BASE_DIR / "vaultfire-core" / "partner_addons.json"


# ---------------------------------------------------------------------------


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


def set_addon_enabled(partner_id: str, addon: str, enabled: bool) -> None:
    cfg = _load_json(CFG_PATH, {})
    partner = cfg.get(partner_id, {})
    partner[addon] = bool(enabled)
    cfg[partner_id] = partner
    _write_json(CFG_PATH, cfg)


def addon_enabled(partner_id: str, addon: str) -> bool:
    cfg = _load_json(CFG_PATH, {})
    return cfg.get(partner_id, {}).get(addon, False)
