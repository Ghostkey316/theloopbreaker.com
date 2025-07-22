"""User-generated module system for Vaultfire games."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .game_logger import log_outcome

BASE_DIR = Path(__file__).resolve().parents[1]
MODS_PATH = BASE_DIR / "logs" / "modding_modules.json"


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


def create_module(mod_id: str, creator: str, belief: str,
                   quests: List[str]) -> Dict:
    """Register a new modding module with associated quests."""
    modules: Dict[str, Dict] = _load_json(MODS_PATH, {})
    if mod_id in modules:
        return {"error": "module_exists"}
    modules[mod_id] = {
        "creator": creator,
        "belief": belief,
        "quests": quests,
        "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "votes": 0,
    }
    _write_json(MODS_PATH, modules)
    return modules[mod_id]


def list_modules() -> Dict[str, Dict]:
    """Return all registered modules."""
    return _load_json(MODS_PATH, {})


def upvote_module(mod_id: str, user_id: str, loyalty: float = 0.1) -> Optional[Dict]:
    """Upvote a module and reward the voter with a loyalty boost."""
    modules: Dict[str, Dict] = _load_json(MODS_PATH, {})
    if mod_id not in modules:
        return None
    entry = modules[mod_id]
    entry["votes"] = entry.get("votes", 0) + 1
    _write_json(MODS_PATH, modules)
    log_outcome(user_id, mod_id, {"upvote": True}, loyalty_boost=loyalty)
    return entry
