"""Growth fork preparation helpers.

DISCLAIMER:
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
"""

from __future__ import annotations
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_PATH = BASE_DIR / "logs" / "growth_prepare_v26.log"


def prepare_v26(
    identity: Dict[str, Any],
    enableMultipliers: bool = False,
    enableOpenAISync: bool = False,
    yieldRewards: bool = False,
) -> Dict[str, Any]:
    """Log preparation of the V26 growth fork."""
    log = load_json(LOG_PATH, [])
    entry = {
        "wallet": identity.get("wallet"),
        "multipliers": enableMultipliers,
        "openai_sync": enableOpenAISync,
        "yield_rewards": yieldRewards,
        "timestamp": datetime.utcnow().isoformat(),
    }
    log.append(entry)
    write_json(LOG_PATH, log)
    return entry
