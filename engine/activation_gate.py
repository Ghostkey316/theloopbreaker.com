from __future__ import annotations
"""Protocol activation gate utilities."""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
HALT_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "halt.flag"


def activation_allowed() -> bool:
    """Return ``True`` if the protocol is not halted."""
    return not HALT_PATH.exists()


def enforce_activation() -> None:
    """Raise ``RuntimeError`` if the protocol is halted."""
    if not activation_allowed():
        raise RuntimeError("Protocol halted by ethics audit")
