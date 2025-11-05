"""Shared constants for Vaultfire protocol upgrades."""

from __future__ import annotations

import os

ARCHITECT_WALLET = "bpow20.cb.id"
ORIGIN_NODE_ID = "Ghostkey-316"
MISSION_STATEMENT = "Belief-secured intelligence for partners who lead with ethics."
MISSION_RESONANCE_THRESHOLD = float(os.getenv("MISSION_RESONANCE_THRESHOLD", "0.72"))

__all__ = [
    "ARCHITECT_WALLET",
    "ORIGIN_NODE_ID",
    "MISSION_RESONANCE_THRESHOLD",
    "MISSION_STATEMENT",
]
