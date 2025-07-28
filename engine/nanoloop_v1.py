"""Vaultfire NanoLoop v1.0

Ethical anchor module for AI-driven nanomedicine. It defines the baseline
sovereignty logic and operational limits for any cell-scale deployment.
This module is dormant until activated by explicit consent or matching
activation tag.

Nothing here is medical advice. It simply records configuration for the
broader protocol.
"""
from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime

OWNER = "Ghostkey-316"
PURPOSE_ENGINE_LINK = "v2"

MODULE_INFO = {
    "module_name": "NanoLoop v1.0",
    "activation_tag": "/phasecell/alpha",
    "owner": OWNER,
    "verification_address": "0xf6A677de83C407875C9A9115Cf100F121f9c4816",
    "deployment_status": "dormant",
    "domain": "BioSovereignty, Nanomedicine, Ethical Healing Systems",
    "codex_layer": "Vaultfire Sovereign Ethics Protocol",
    "category": "Post-Pharmaceutical Regenerative AI",
    "priority_level": "Maximum",
    "purpose_engine_link": PURPOSE_ENGINE_LINK,
}

DIRECTIVES = [
    "No Deployment Without Consent",
    "Code Must Heal First",
    "No Cross-Body Networking Without Clearance",
    "Human Repair > Data Collection",
    "Self-Termination Protocol Required",
]

STATUS_PATH = Path(__file__).resolve().parents[1] / "vaultfire-core" / "nanoloop_status.json"


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


def module_status() -> dict:
    """Return current stored status for NanoLoop."""
    data = _load_json(STATUS_PATH, {})
    if not data:
        data["status"] = MODULE_INFO["deployment_status"]
        _write_json(STATUS_PATH, data)
    return data


def activate(trigger: str, consent: bool = False) -> bool:
    """Activate module if trigger or consent is provided."""
    state = module_status()
    if state.get("status") == "active":
        return True
    if consent or trigger == MODULE_INFO["activation_tag"]:
        state["status"] = "active"
        state["activated_at"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        _write_json(STATUS_PATH, state)
        return True
    return False


__all__ = [
    "MODULE_INFO",
    "DIRECTIVES",
    "module_status",
    "activate",
    "PURPOSE_ENGINE_LINK",
]
