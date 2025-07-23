"""Real-time wager battles using Vault Points or tokens."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from uuid import uuid4

from .mission_scheduler import record_reward
from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
WAGER_PATH = BASE_DIR / "logs" / "wager_battles.json"


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


def _battles() -> Dict:
    return _load_json(WAGER_PATH, {})


def _save(battles: Dict) -> None:
    _write_json(WAGER_PATH, battles)


# ---------------------------------------------------------------------------
# Battle Lifecycle
# ---------------------------------------------------------------------------

def start_battle(game_id: str, players: List[str], amount: float, token: str = "LOYAL") -> Dict:
    """Create a new wager battle."""
    battles = _battles()
    bid = f"battle-{uuid4().hex}"
    entry = {
        "id": bid,
        "game_id": game_id,
        "players": players,
        "amount": amount,
        "token": token,
        "start": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "active": True,
    }
    battles[bid] = entry
    _save(battles)
    return entry


def record_result(battle_id: str, winner: str) -> Optional[Dict]:
    """Finalize a battle and reward ``winner``."""
    battles = _battles()
    entry = battles.get(battle_id)
    if not entry or not entry.get("active"):
        return None
    entry["active"] = False
    entry["winner"] = winner
    entry["end"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    _save(battles)
    record_reward(winner, "wager", int(entry.get("amount", 0)))
    try:
        send_token(winner, entry.get("amount", 0), entry.get("token", "LOYAL"))
    except Exception:
        pass
    return entry


__all__ = ["start_battle", "record_result"]
