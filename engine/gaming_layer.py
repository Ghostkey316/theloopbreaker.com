"""Manage multiplayer game sessions with reward hooks."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import logging

from .partner_hooks import grant_reward

BASE_DIR = Path(__file__).resolve().parents[1]
SESSIONS_PATH = BASE_DIR / "logs" / "game_sessions.json"

logger = logging.getLogger(__name__)


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


def create_session(
    game_id: str,
    creator: str,
    metadata: Optional[Dict] = None,
    stream_handle: str | None = None,
) -> Dict:
    """Create a new game session and return the record."""
    sessions: List[Dict] = _load_json(SESSIONS_PATH, [])
    session = {
        "game_id": game_id,
        "creator": creator,
        "players": [creator],
        "metadata": metadata or {},
        "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "active": True,
    }
    if stream_handle:
        try:
            from .twitch_layer import start_stream
            start_stream(stream_handle)
            session["stream"] = stream_handle
        except Exception:
            logger.exception("start_stream failed for %s", stream_handle)
            session["stream"] = stream_handle
    sessions.append(session)
    _write_json(SESSIONS_PATH, sessions)
    return session


def join_session(game_id: str, player: str) -> Optional[Dict]:
    """Add ``player`` to the session ``game_id``."""
    sessions: List[Dict] = _load_json(SESSIONS_PATH, [])
    for session in sessions:
        if session.get("game_id") == game_id and session.get("active"):
            if player not in session["players"]:
                session["players"].append(player)
                _write_json(SESSIONS_PATH, sessions)
            return session
    return None


def end_session(game_id: str, reward_per_player: float = 0.0, token: str = "ASM") -> Optional[Dict]:
    """End ``game_id`` session and optionally reward each player."""
    sessions: List[Dict] = _load_json(SESSIONS_PATH, [])
    for session in sessions:
        if session.get("game_id") == game_id and session.get("active"):
            session["active"] = False
            session["ended"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            if session.get("stream"):
                try:
                    from .twitch_layer import end_stream
                    end_stream(session["stream"])
                except Exception:
                    logger.exception("end_stream failed for %s", session["stream"])
            _write_json(SESSIONS_PATH, sessions)
            if reward_per_player > 0:
                for player in session.get("players", []):
                    try:
                        grant_reward(player, player, reward_per_player, token)
                    except Exception:
                        logger.exception("grant_reward failed for player %s", player)
            return session
    return None
