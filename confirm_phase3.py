"""Confirm Phase 3 Codex expansion tied to Ghostkey-316."""
from __future__ import annotations

import json
from importlib.machinery import SourceFileLoader
from pathlib import Path

STATUS_PATH = Path(__file__).resolve().parent / "codex_update_block.status"
PROOF_PATH = Path(__file__).resolve().parent / "vaultfire-proof.codex"


def confirm() -> dict:
    status = STATUS_PATH.read_text().strip()
    proof = SourceFileLoader("proof", str(PROOF_PATH)).load_module()
    proof_log = proof.confirm()
    return {"phase": status, "identity": proof_log.get("identity")}


if __name__ == "__main__":
    print(json.dumps(confirm(), indent=2))
