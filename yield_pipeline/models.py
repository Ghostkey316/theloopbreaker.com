"""Data models for the Vaultfire yield pipeline."""

from __future__ import annotations

from datetime import datetime
from hashlib import sha256
from typing import List, Optional

from pydantic import BaseModel, Field


class ActivationSignal(BaseModel):
    signal: str
    weight: float


class PilotLog(BaseModel):
    mission_id: str
    pilot_id: str
    belief_id: str
    timestamp: datetime
    trigger_event: str
    ghostscore_delta: float
    activation_signals: List[ActivationSignal] = Field(default_factory=list)

    @property
    def hashed_mission_id(self) -> str:
        """Return a deterministic SHA256 hash of the mission identifier."""

        return sha256(self.mission_id.encode("utf-8")).hexdigest()


class CaseStudy(BaseModel):
    timestamp: datetime
    belief_segment: str
    yield_classification: str
    ghostscore_roi: float
    trigger_summary: str
    mission_hash: str


class YieldInsight(BaseModel):
    mission_id: str
    belief_segment: str
    yield_type: str
    ghostscore_delta: float
    timestamp: datetime


class YieldSimulationResult(BaseModel):
    user_hash: str
    mission_hashes: List[str]
    estimated_retention_boost: float
    referral_probability: float
    projected_active_minutes: float
    generated_at: datetime
    notes: Optional[str] = None


def anonymize_belief_segment(belief_id: str) -> str:
    """Return a privacy-preserving belief segment label."""

    prefix = belief_id.split("-")[0]
    return f"{prefix}-{belief_id[-2:]}"


YIELD_CLASSIFICATION_RULES = {
    "engage": "engagement",
    "convert": "conversion",
    "retain": "retention",
}


def classify_yield(belief_id: str, ghostscore_delta: float) -> str:
    """Derive a yield classification from the belief id and score delta."""

    for key, label in YIELD_CLASSIFICATION_RULES.items():
        if key in belief_id:
            return label
    return "engagement" if ghostscore_delta >= 0 else "risk"
