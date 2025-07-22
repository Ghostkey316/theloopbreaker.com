"""Partner Port SDK for third-party games."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List
from uuid import uuid4

from engine.activation_gate import enforce_activation
from engine.game_logger import log_outcome
from engine.token_ops import send_token
from vaultfire_arcade.guest_progress import merge_guest_progress

BASE_DIR = Path(__file__).resolve().parents[1]
KEYS_PATH = BASE_DIR / "logs" / "partner_port_keys.json"
XP_PATH = BASE_DIR / "logs" / "partner_port_xp.json"
QUEST_PATH = BASE_DIR / "logs" / "partner_port_quests.json"
SYNC_PATH = BASE_DIR / "logs" / "partner_port_onchain.json"


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


def generate_api_key(partner_id: str) -> str:
    """Generate and store an API key for ``partner_id``."""
    enforce_activation()
    keys = _load_json(KEYS_PATH, {})
    api_key = uuid4().hex
    keys[partner_id] = api_key
    _write_json(KEYS_PATH, keys)
    return api_key


def validate_api_key(partner_id: str, api_key: str) -> bool:
    """Return ``True`` if ``api_key`` matches ``partner_id``."""
    keys = _load_json(KEYS_PATH, {})
    return keys.get(partner_id) == api_key


def revoke_api_key(partner_id: str) -> None:
    """Remove API key for ``partner_id`` if present."""
    keys = _load_json(KEYS_PATH, {})
    if partner_id in keys:
        del keys[partner_id]
        _write_json(KEYS_PATH, keys)


class PartnerPort:
    """Interface for third-party games to record progress."""

    def __init__(self, partner_id: str, api_key: str):
        if not validate_api_key(partner_id, api_key):
            raise RuntimeError("invalid api key")
        self.partner_id = partner_id
        self.api_key = api_key

    # ------------------------------------------------------------------
    # Progress Recording
    # ------------------------------------------------------------------
    def record_xp(self, user_id: str, xp: int) -> Dict:
        """Record XP earned by ``user_id``."""
        enforce_activation()
        log: List[Dict] = _load_json(XP_PATH, [])
        entry = {
            "partner_id": self.partner_id,
            "user_id": user_id,
            "xp": xp,
        }
        log.append(entry)
        _write_json(XP_PATH, log)
        return entry

    def award_loyalty(self, user_id: str, amount: float, token: str = "LOYAL") -> Dict:
        """Award loyalty tokens to ``user_id``."""
        enforce_activation()
        send_token(user_id, amount, token)
        return {"user_id": user_id, "amount": amount, "token": token}

    def quest_progress(self, user_id: str, quest_id: str, progress: float) -> Dict:
        """Update quest progress for ``user_id``."""
        enforce_activation()
        quests: Dict[str, Dict[str, float]] = _load_json(QUEST_PATH, {})
        user = quests.setdefault(user_id, {})
        user[quest_id] = max(user.get(quest_id, 0.0), progress)
        _write_json(QUEST_PATH, quests)
        return {"user_id": user_id, "quest_id": quest_id, "progress": progress}

    def log_outcome(self, user_id: str, game_id: str, outcome: Dict, loyalty_boost: float = 0.0) -> Dict:
        """Log a game outcome and update loyalty."""
        enforce_activation()
        log_outcome(user_id, game_id, outcome, outcome.get("achievements", []), loyalty_boost)
        if loyalty_boost:
            send_token(user_id, loyalty_boost, "LOYAL")
        return {"user_id": user_id, "game_id": game_id}

    # ------------------------------------------------------------------
    # Sync & Merging
    # ------------------------------------------------------------------
    def sync_onchain(self) -> None:
        """Mark recorded progress for on-chain sync."""
        payload = {
            "partner_id": self.partner_id,
            "xp": _load_json(XP_PATH, []),
            "quests": _load_json(QUEST_PATH, {}),
        }
        _write_json(SYNC_PATH, payload)

    @staticmethod
    def merge_profiles(source_id: str, target_id: str) -> None:
        """Merge stored progress from ``source_id`` into ``target_id``."""
        merge_guest_progress(source_id, target_id)

__all__ = [
    "generate_api_key",
    "validate_api_key",
    "revoke_api_key",
    "PartnerPort",
]
