"""Confirm Vaultfire Phase 2 handshake readiness."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
PARTNERS_PATH = BASE_DIR / "partners.json"

EXPECTED_MISSION = "Humanity First. Private. Decentralized. Ethical."
EXPECTED_PARTNER_SIGNAL = "Ghostkey-316"
PHASE_LABEL = "Phase 2"
ALIGNMENT_PHRASE = "Morals Before Metrics."


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def _alignment_signature(phrase: str) -> str:
    normalized = phrase.strip().lower().encode("utf-8")
    return hashlib.sha256(normalized).hexdigest()


def confirm() -> Dict[str, Any]:
    """Return a snapshot of the Phase 2 handshake state."""
    config = _load_json(CONFIG_PATH)
    partners = _load_json(PARTNERS_PATH)
    handshake = config.get("phase_two_handshake", {})

    status = handshake.get("status", "unknown")
    mission = handshake.get("mission")
    loop_integrity = bool(handshake.get("loop_integrity_check", False))
    partner_signal = handshake.get("partner_signal")

    architect_online = any(partner.get("role") == "Architect" for partner in partners)
    mission_confirmed = mission == EXPECTED_MISSION
    partner_confirmed = partner_signal == EXPECTED_PARTNER_SIGNAL

    ready = (
        status in {"initiated", "awaiting_confirmation"}
        and mission_confirmed
        and loop_integrity
        and architect_online
        and partner_confirmed
    )

    return {
        "phase": PHASE_LABEL,
        "status": status,
        "mission": mission,
        "mission_confirmed": mission_confirmed,
        "loop_integrity": "ON" if loop_integrity else "OFF",
        "architect_online": architect_online,
        "partner_signal": partner_signal,
        "alignment_phrase": ALIGNMENT_PHRASE,
        "alignment_signature": _alignment_signature(ALIGNMENT_PHRASE),
        "ready_for_confirmation": ready,
    }


if __name__ == "__main__":
    print(json.dumps(confirm(), indent=2))
