"""Play2Earn engine for Vaultfire."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .identity_resolver import resolve_identity
from .loyalty_multiplier import loyalty_multiplier
from .token_ops import send_token
from .mission_scheduler import record_reward
from .inventory_storage import add_item
from .proof_of_loyalty import record_belief_action

BASE_DIR = Path(__file__).resolve().parents[1]
ACCOUNTS_PATH = BASE_DIR / "logs" / "p2e_accounts.json"
SESSIONS_PATH = BASE_DIR / "logs" / "p2e_sessions.json"

ALLOWED_PLATFORMS = {"steam", "xbox", "playstation", "mobile", "web3"}


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

def connect_game_account(user_id: str, platform: str, account_id: str) -> Dict:
    """Link a gaming account to ``user_id``."""
    platform = platform.lower()
    if platform not in ALLOWED_PLATFORMS:
        raise ValueError("unsupported platform")
    data = _load_json(ACCOUNTS_PATH, {})
    entry = data.get(user_id, {})
    entry[platform] = account_id
    data[user_id] = entry
    _write_json(ACCOUNTS_PATH, data)
    return entry


def linked_accounts(user_id: str) -> Dict:
    """Return linked accounts for ``user_id``."""
    data = _load_json(ACCOUNTS_PATH, {})
    return data.get(user_id, {})


# ---------------------------------------------------------------------------
# Session Tracking & Rewards
# ---------------------------------------------------------------------------

def _resolve_wallet(user_id: str) -> Optional[str]:
    scorecard_path = BASE_DIR / "user_scorecard.json"
    score = _load_json(scorecard_path, {})
    wallet = score.get(user_id, {}).get("wallet")
    if wallet:
        return resolve_identity(wallet) or wallet
    return None


def _award_tokens(user_id: str, amount: float) -> None:
    wallet = _resolve_wallet(user_id)
    if wallet and amount > 0:
        try:
            send_token(wallet, amount, "ASM")
        except Exception:
            pass


def _award_nft(user_id: str, points: int) -> None:
    if points and points % 100 == 0:
        try:
            add_item(user_id, f"p2e-nft-{points}", "onchain")
        except Exception:
            pass


def record_session(
    user_id: str,
    game_id: str,
    platform: str,
    duration_minutes: float,
    achievements: Optional[List[str]] = None,
    team: Optional[List[str]] = None,
    game_type: str | None = None,
    skill_score: float = 1.0,
) -> Dict:
    """Record a play session and distribute rewards."""
    platform = platform.lower()
    if platform not in ALLOWED_PLATFORMS:
        raise ValueError("unsupported platform")

    log: List[Dict] = _load_json(SESSIONS_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "game_id": game_id,
        "platform": platform,
        "duration": duration_minutes,
        "achievements": achievements or [],
        "team": team or [],
        "type": game_type or "",
    }
    log.append(entry)
    _write_json(SESSIONS_PATH, log)

    base_points = max(1, int(duration_minutes))
    points = int((base_points + skill_score * len(entry["achievements"])) * loyalty_multiplier(user_id))
    record_reward(user_id, "gaming", points)
    _award_tokens(user_id, points * 0.1)
    _award_nft(user_id, points)

    entry["points"] = points
    return entry


# ---------------------------------------------------------------------------
# Belief Missions
# ---------------------------------------------------------------------------

def belief_mission(user_id: str, wallet: str, text: str, game_id: str) -> Dict:
    """Record a belief-based mission tied to ``game_id``."""
    result = record_belief_action(user_id, wallet, text)
    result["game_id"] = game_id
    return result


# ---------------------------------------------------------------------------
# Leaderboards
# ---------------------------------------------------------------------------

def leaderboard(top_n: int = 10) -> List[Dict]:
    """Return top ``top_n`` players by gaming points."""
    points = _load_json(BASE_DIR / "logs" / "vault_points.json", {})
    scores = {uid: data.get("gaming", 0) for uid, data in points.items()}
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    board = [{"user_id": uid, "points": pts} for uid, pts in ranked[:top_n]]
    return board


__all__ = [
    "connect_game_account",
    "linked_accounts",
    "record_session",
    "belief_mission",
    "leaderboard",
]
