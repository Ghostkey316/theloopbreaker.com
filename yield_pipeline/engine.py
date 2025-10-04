"""Activation-to-yield simulation utilities."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from statistics import mean
from typing import List

from .config import settings
from .models import PilotLog, YieldSimulationResult
from .converter import _load_pilot_log


def _hash_identifier(identifier: str) -> str:
    return sha256(identifier.encode("utf-8")).hexdigest()


def _load_user_missions(user_id: str, source: Path | None = None) -> List[PilotLog]:
    source_dir = Path(source or settings.mission_logs_dir)
    missions: List[PilotLog] = []
    for path in source_dir.glob("*.json"):
        log = _load_pilot_log(path)
        if log.pilot_id == user_id:
            missions.append(log)
    return missions


def simulate_activation_to_yield(user_id: str) -> dict:
    """Calculate projected yield outcomes for a given user."""

    missions = _load_user_missions(user_id)
    if not missions:
        raise ValueError(f"No mission history found for user: {user_id}")

    total_delta = sum(m.ghostscore_delta for m in missions)
    avg_signal_weight = mean(
        signal.weight for mission in missions for signal in mission.activation_signals
    ) if any(m.activation_signals for m in missions) else 0.0

    estimated_retention_boost = min(0.35 + total_delta / 100, 0.95)
    referral_probability = min(0.1 + avg_signal_weight * 0.5 + len(missions) * 0.05, 0.99)
    projected_active_minutes = round(45 + total_delta * 1.8, 2)

    result = YieldSimulationResult(
        user_hash=_hash_identifier(user_id),
        mission_hashes=[mission.hashed_mission_id for mission in missions],
        estimated_retention_boost=round(estimated_retention_boost, 3),
        referral_probability=round(referral_probability, 3),
        projected_active_minutes=projected_active_minutes,
        generated_at=datetime.now(timezone.utc),
        notes="Derived from historical ghostscore trends.",
    )

    settings.yield_reports_dir.mkdir(parents=True, exist_ok=True)
    report_path = settings.yield_reports_dir / f"{result.user_hash}.json"
    with report_path.open("w", encoding="utf-8") as handle:
        json.dump(result.model_dump(mode="json"), handle, indent=2)

    return result.model_dump(mode="json")
