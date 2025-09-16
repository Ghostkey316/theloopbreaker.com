"""Mission statement registry backed by authenticated encryption."""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Mapping, Optional

from utils.crypto import decrypt_text, derive_key, encrypt_text
from utils.json_io import load_json, write_json

from .alignment_guard import evaluate_alignment
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "missions.json"
DEFAULT_KEY = os.environ.get("MISSION_KEY", "vaultfire")


def _key_bytes(key: Optional[str]) -> bytes:
    secret = key if key is not None else DEFAULT_KEY
    return derive_key(secret)


def encrypt_mission(mission: str, key: Optional[str] = None) -> str:
    return encrypt_text(_key_bytes(key), mission)


def decrypt_mission(token: str, key: Optional[str] = None) -> str:
    return decrypt_text(_key_bytes(key), token)


# --- Mission registry functions -------------------------------------------

def record_mission(
    user_id: str,
    wallet: str,
    mission: str,
    key: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
) -> dict:
    """Store encrypted ``mission`` for ``user_id`` and associated ``wallet``."""
    extra_payload: Dict[str, Any] = {}
    identity_payload: Dict[str, Any] = {"user_id": user_id, "wallet": wallet}
    if isinstance(metadata, Mapping):
        for key_name in (
            "mission_tags",
            "missionTags",
            "belief_density",
            "beliefDensity",
            "empathy_score",
            "empathyScore",
            "override",
            "override_signature",
            "trust_tier",
            "trustTier",
            "beliefSignature",
            "belief_signature",
        ):
            if key_name in metadata:
                extra_payload[key_name] = metadata[key_name]
        identity_payload.update({k: metadata[k] for k in metadata if isinstance(k, str)})

    guard_payload = {
        "mission": mission,
        "declared_purpose": mission,
        "mission_tags": extra_payload.get("mission_tags") or extra_payload.get("missionTags") or ["mission-registry"],
        "belief_density": extra_payload.get("belief_density") or extra_payload.get("beliefDensity") or 1.0,
        "empathy_score": extra_payload.get("empathy_score") or extra_payload.get("empathyScore") or 0.72,
        "override": extra_payload.get("override"),
        "override_signature": extra_payload.get("override_signature") or extra_payload.get("beliefSignature") or extra_payload.get("belief_signature"),
        "trust_tier": extra_payload.get("trust_tier") or extra_payload.get("trustTier"),
    }
    guard_result = evaluate_alignment(
        "mission.record",
        guard_payload,
        identity=identity_payload,
        override_requested=bool(extra_payload.get("override")),
    )
    if not guard_result["allowed"]:
        reasons = guard_result["reasons"] or ["alignment guard rejection"]
        raise PermissionError("; ".join(reasons))

    data = load_json(DATA_PATH, {})
    enc = encrypt_mission(mission, key)
    entry = {
        "wallet": wallet,
        "mission": enc,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    entry["alignment_guard"] = {
        "decision": guard_result["decision"],
        "reasons": guard_result["reasons"],
        "override": guard_result["override"],
        "drift": guard_result["drift"],
    }
    data[user_id] = entry
    write_json(DATA_PATH, data)
    return entry


def get_mission(user_id: str, key: Optional[str] = None) -> Optional[str]:
    data = load_json(DATA_PATH, {})
    entry = data.get(user_id)
    if not entry:
        return None
    try:
        return decrypt_mission(entry.get("mission", ""), key)
    except Exception:
        return None


def get_mission_by_wallet(wallet: str, key: Optional[str] = None) -> Optional[str]:
    data = load_json(DATA_PATH, {})
    for entry in data.values():
        if entry.get("wallet") == wallet:
            try:
                return decrypt_mission(entry.get("mission", ""), key)
            except Exception:
                return None
    return None
