"""Partner protocol shell utilities for Vaultfire v27.2."""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Dict

BASE_DIR = Path(__file__).resolve().parents[1]
TESTBED_DIR = Path(os.getenv("PARTNER_PROTOCOL_DIR", BASE_DIR / "partner_protocols"))


def clone_protocol(version: str, partner_id: str) -> Path:
    """Create or replace a versioned testbed directory."""
    target = TESTBED_DIR / f"{partner_id}_{version}"
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    return target


def setup_shell(version: str, partner_id: str, ens: str, wallet: str) -> Dict:
    """Initialize protocol shell with bound ENS and wallet."""
    path = clone_protocol(version, partner_id)
    cfg = {
        "version": version,
        "partner_id": partner_id,
        "ens": ens,
        "wallet": wallet,
        "plugin_ready": True,
    }
    (path / "partner_shell_config.json").write_text(json.dumps(cfg, indent=2))
    return cfg


def sync_echo(path: Path) -> None:
    """Record echo sync confirmation."""
    (path / "echo_synced").write_text("ok")


def register_fallback(path: Path, endpoint: str) -> None:
    """Register remote fallback endpoint for the shell."""
    (path / "remote_fallback.json").write_text(json.dumps({"endpoint": endpoint}, indent=2))


__all__ = ["setup_shell", "sync_echo", "register_fallback", "TESTBED_DIR"]
