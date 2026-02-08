"""Local import shim.

This repo contains a top-level Python package directory named `Vaultfire/`.
Some modules historically import it as `vaultfire.*`.

On some systems (notably case-sensitive module resolution), `import vaultfire`
will fail even though `Vaultfire/` exists.

This shim aliases `vaultfire` -> `Vaultfire` by creating a lightweight package
module with __path__ pointing at the `Vaultfire/` directory.

It is loaded automatically by Python when present on sys.path.
"""

from __future__ import annotations

import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VF_DIR = ROOT / "Vaultfire"

if VF_DIR.exists() and "vaultfire" not in sys.modules:
    pkg = types.ModuleType("vaultfire")
    pkg.__path__ = [str(VF_DIR)]  # type: ignore[attr-defined]
    sys.modules["vaultfire"] = pkg
