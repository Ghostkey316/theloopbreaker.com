"""Arcade-style launcher for Vaultfire games."""

from __future__ import annotations

import importlib
import json
from pathlib import Path
from typing import Dict, List, Optional
from uuid import uuid4

from vaultfire_gaming import VaultfireGameSDK
from engine.game_logger import log_outcome

BASE_DIR = Path(__file__).resolve().parent
GAMES_PATH = BASE_DIR / "games.json"


def _load_games() -> Dict[str, dict]:
    if GAMES_PATH.exists():
        try:
            with open(GAMES_PATH) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}


class ArcadeLauncher:
    """Simple launcher that runs registered games and logs outcomes."""

    def __init__(self, user_id: Optional[str] = None):
        if user_id:
            self.user_id = user_id
            self.is_guest = False
        else:
            self.user_id = f"guest-{uuid4().hex}"
            self.is_guest = True
        self.sdk = VaultfireGameSDK("VaultfireArcade")
        self.games = _load_games()

    def merge_progress(self, new_user_id: str) -> None:
        """Merge guest session data into ``new_user_id``."""
        if not self.is_guest or not new_user_id:
            return
        from .guest_progress import merge_guest_progress

        merge_guest_progress(self.user_id, new_user_id)
        self.user_id = new_user_id
        self.is_guest = False

    def list_games(self) -> List[str]:
        return list(self.games.keys())

    def launch(self, game_id: str) -> dict:
        meta = self.games.get(game_id)
        if not meta:
            raise ValueError("unknown game")
        self.sdk.new_game(game_id, meta)
        outcome = {}
        module_name = meta.get("module")
        if module_name:
            try:
                module = importlib.import_module(module_name)
                if hasattr(module, "run"):
                    outcome = module.run(self.user_id) or {}
            except Exception:
                outcome = {"error": "failed"}
        achievements = outcome.get("achievements", [])
        loyalty = float(outcome.get("loyalty_boost", 0))
        log_outcome(self.user_id, game_id, outcome, achievements, loyalty)
        self.sdk.end(game_id, reward_per_player=loyalty, token="LOYAL")
        return outcome
