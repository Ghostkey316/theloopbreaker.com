"""Activate Global Identity Kernel and log proof-of-belief."""
from __future__ import annotations

import json
from datetime import datetime
from importlib.machinery import SourceFileLoader
from pathlib import Path

from engine.immutable_log import append_entry

BASE_DIR = Path(__file__).resolve().parent
STATE_PATH = BASE_DIR / "kernel_state.json"
PROOF_PATH = BASE_DIR / "vaultfire-proof.codex"


def activate(identity: str = "Ghostkey-316") -> dict:
    """Set kernel identity state and log proof-of-belief."""
    state = {
        "kernel_identity": identity,
        "phase": "PHASE3_ACTIVE",
        "locked": True,
        "trust_anchor": "Ghostkey Growth Protocol v1.0",
        "ethics_core": "Ghostkey Ethics Framework v1.0",
        "mode_training": True,
        "memory_recursive_learning": True,
        "signal_loop": "belief+ethics grafted",
        "override_permission": "Ghostkey-316 Only",
        "branch_immutable": True,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)

    proof = SourceFileLoader("proof", str(PROOF_PATH)).load_module()
    proof_log = proof.confirm()
    append_entry("Vaultfire_Proof-of-Belief", proof_log)
    return state


if __name__ == "__main__":
    result = activate()
    print(json.dumps(result, indent=2))
