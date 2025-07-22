"""Generate real-time health recommendations."""
from __future__ import annotations

from typing import List

from .biofeedback import get_latest_biofeedback


def recommendations(identifier: str) -> List[str]:
    """Return simple advice based on stored biofeedback."""
    data = get_latest_biofeedback(identifier)
    recs: List[str] = []
    if not data:
        return recs

    hrv = data.get("hrv")
    if hrv is not None and hrv < 40:
        recs.append("Try deep breathing exercises to raise HRV.")

    bp = data.get("blood_pressure")
    if bp is not None and bp > 130:
        recs.append("Consider light activity to lower blood pressure.")

    glucose = data.get("glucose")
    if glucose is not None and glucose > 140:
        recs.append("Limit sugary foods to stabilize glucose.")

    return recs
