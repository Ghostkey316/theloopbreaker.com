from __future__ import annotations

"""Support multiple wallets and social handles per user."""

import hashlib
import json
from datetime import datetime
from pathlib import Path

from engine.contributor_identity import sync_identity, identity_summary

BASE_DIR = Path(__file__).resolve().parents[1]
MULTI_ID_PATH = BASE_DIR / "logs" / "multi_identity.json"


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


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


# ---------------------------------------------------------------------------


def link_wallet(user_id: str, wallet: str) -> dict:
    """Link ``wallet`` to ``user_id`` using the identity module."""
    return sync_identity(user_id, wallet=wallet)


def assign_handle(user_id: str, handle_type: str, handle: str) -> None:
    """Associate ``handle`` with ``user_id`` under ``handle_type``."""
    data = _load_json(MULTI_ID_PATH, {})
    profile = data.get(user_id, {"handles": {}, "tags": []})
    profile["handles"][handle_type] = handle
    profile["updated"] = datetime.utcnow().isoformat()
    data[user_id] = profile
    _write_json(MULTI_ID_PATH, data)
    sync_identity(user_id, socials={handle_type: handle})


def add_tag(user_id: str, tag: str) -> None:
    data = _load_json(MULTI_ID_PATH, {})
    profile = data.get(user_id, {"handles": {}, "tags": []})
    if tag not in profile.get("tags", []):
        profile.setdefault("tags", []).append(tag)
    profile["updated"] = datetime.utcnow().isoformat()
    data[user_id] = profile
    _write_json(MULTI_ID_PATH, data)


def identity_cluster(user_id: str) -> dict:
    """Return profile summary for ``user_id``."""
    profile = _load_json(MULTI_ID_PATH, {}).get(user_id, {"handles": {}, "tags": []})
    summary = identity_summary(user_id)
    summary.update({"handles": profile.get("handles", {}), "tags": profile.get("tags", [])})
    return summary


def cluster_analytics(redact: bool = False) -> dict:
    """Return aggregated statistics across identity clusters."""
    data = _load_json(MULTI_ID_PATH, {})
    total_wallets = 0
    total_handles = 0
    for uid in data:
        summary = identity_summary(uid)
        total_wallets += len(summary.get("wallets", []))
        total_handles += len(data[uid].get("handles", {}))
    stats = {
        "users": len(data),
        "wallets": total_wallets,
        "handles": total_handles if not redact else "redacted",
    }
    return stats
