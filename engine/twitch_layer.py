"""Twitch integration helpers for Vaultfire gaming."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .loyalty_engine import update_loyalty_ranks
from .mission_scheduler import record_reward
from .token_ops import send_token
from .contributor_identity import identity_summary

BASE_DIR = Path(__file__).resolve().parents[1]
ACCOUNTS_PATH = BASE_DIR / "logs" / "twitch_accounts.json"
STREAMS_PATH = BASE_DIR / "logs" / "twitch_streams.json"
OVERLAYS_PATH = BASE_DIR / "logs" / "twitch_overlays.json"
TIPS_PATH = BASE_DIR / "logs" / "twitch_tips.json"


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
# Account Linking
# ---------------------------------------------------------------------------

def connect_twitch_account(user_id: str, handle: str) -> Dict:
    """Associate a Twitch ``handle`` with ``user_id``."""
    accounts = _load_json(ACCOUNTS_PATH, {})
    accounts[user_id] = handle
    _write_json(ACCOUNTS_PATH, accounts)
    return {"user_id": user_id, "handle": handle}


# ---------------------------------------------------------------------------
# Streaming Events
# ---------------------------------------------------------------------------

def start_stream(handle: str) -> Dict:
    """Record that ``handle`` went live."""
    streams = _load_json(STREAMS_PATH, [])
    entry = {
        "handle": handle,
        "event": "start",
        "time": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    streams.append(entry)
    _write_json(STREAMS_PATH, streams)
    return entry


def end_stream(handle: str) -> Dict:
    """Record that ``handle`` ended a stream."""
    streams = _load_json(STREAMS_PATH, [])
    entry = {
        "handle": handle,
        "event": "end",
        "time": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    streams.append(entry)
    _write_json(STREAMS_PATH, streams)
    return entry


# ---------------------------------------------------------------------------
# Belief Challenges
# ---------------------------------------------------------------------------

def overlay_challenge(stream_id: str, text: str) -> Dict:
    """Overlay a belief challenge on a stream."""
    overlays = _load_json(OVERLAYS_PATH, [])
    entry = {
        "stream": stream_id,
        "text": text,
        "time": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    overlays.append(entry)
    _write_json(OVERLAYS_PATH, overlays)
    return entry


# ---------------------------------------------------------------------------
# Tips and Leaderboards
# ---------------------------------------------------------------------------

def tip_streamer(from_user: str, to_user: str, amount: float, token: str = "LOYAL") -> Dict:
    """Send a tip from ``from_user`` to ``to_user``."""
    summary = identity_summary(to_user)
    wallet = summary.get("wallets", [None])[0] if summary.get("wallets") else None
    success = False
    if wallet:
        try:
            send_token(wallet, amount, token)
            success = True
        except Exception:
            success = False
    tips = _load_json(TIPS_PATH, [])
    entry = {
        "from": from_user,
        "to": to_user,
        "amount": amount,
        "token": token,
        "success": success,
        "time": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    tips.append(entry)
    _write_json(TIPS_PATH, tips)
    record_reward(to_user, "twitch_tip", int(amount))
    return entry


def loyalty_board(top_n: int = 10) -> List[Dict]:
    """Return the latest loyalty ranks."""
    return update_loyalty_ranks()[:top_n]


__all__ = [
    "connect_twitch_account",
    "start_stream",
    "end_stream",
    "overlay_challenge",
    "tip_streamer",
    "loyalty_board",
]
