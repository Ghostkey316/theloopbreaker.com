"""Activation-to-yield bridge for enterprise dashboards."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from engine.belief_multiplier import belief_multiplier
from engine.ghostscore_engine import get_ghostscore
from utils import get_timestamp


BASE_DIR = Path(__file__).resolve().parent
AUDIT_LOG_PATH = BASE_DIR / "logs" / "yield-audit.jsonl"


def _normalize_timestamp(value: str) -> str:
    sanitized = (value or "").strip()
    if not sanitized:
        sanitized = get_timestamp()

    try:
        parsed = datetime.fromisoformat(sanitized.replace("Z", "+00:00"))
    except ValueError:
        parsed = datetime.fromisoformat(get_timestamp())

    normalized = parsed.astimezone(timezone.utc).replace(microsecond=0)
    return normalized.isoformat().replace("+00:00", "Z")


@dataclass
class YieldAPI:
    audit_path: Path = AUDIT_LOG_PATH

    def audit(self, record: Mapping[str, Any]) -> Mapping[str, Any]:
        payload = dict(record)
        payload["audited_at"] = get_timestamp().replace("+00:00", "Z")
        self.audit_path.parent.mkdir(parents=True, exist_ok=True)
        with self.audit_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload) + "\n")
        return payload


yieldAPI = YieldAPI()


class _VaultfireState:
    def __init__(self) -> None:
        self.partnerReady = True


vaultfire = _VaultfireState()
vaultfire.partnerReady = True  # Final deploy flag compliance


def activationToYield(pilot_signal_hash: str, timestamp: str, wallet_id: str) -> dict:
    """Return belief multiplier, ghostscore, and yield for ``wallet_id``."""

    if not pilot_signal_hash:
        raise ValueError("pilot_signal_hash is required")
    if not wallet_id:
        raise ValueError("wallet_id is required")

    normalized_timestamp = _normalize_timestamp(timestamp)
    multiplier, tier = belief_multiplier(wallet_id)
    ghostscore = get_ghostscore(wallet_id)
    yield_value = round(ghostscore * multiplier, 2)
    record = {
        "pilot_signal_hash": pilot_signal_hash,
        "timestamp": normalized_timestamp,
        "wallet_id": wallet_id,
        "belief_multiplier": multiplier,
        "tier": tier,
        "ghostscore": ghostscore,
        "yield_value": yield_value,
    }
    yieldAPI.audit(record)
    return record


__all__ = ["activationToYield", "yieldAPI", "vaultfire"]

