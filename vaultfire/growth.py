"""Growth fork preparation helpers.

DISCLAIMER:
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_PATH = BASE_DIR / "logs" / "growth_prepare_v26.log"


def _load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data: Any) -> None:
    os.makedirs(path.parent, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def prepare_v26(
    identity: Dict[str, Any],
    enableMultipliers: bool = False,
    enableOpenAISync: bool = False,
    yieldRewards: bool = False,
) -> Dict[str, Any]:
    """Log preparation of the V26 growth fork."""
    log = _load_json(LOG_PATH, [])
    entry = {
        "wallet": identity.get("wallet"),
        "multipliers": enableMultipliers,
        "openai_sync": enableOpenAISync,
        "yield_rewards": yieldRewards,
        "timestamp": datetime.utcnow().isoformat(),
    }
    log.append(entry)
    _write_json(LOG_PATH, log)
    return entry
