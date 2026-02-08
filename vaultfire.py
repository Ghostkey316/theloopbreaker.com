"""Compatibility module: allow `import vaultfire.*`.

The canonical source tree uses a top-level directory named `Vaultfire/`.
Some tools (and historical code) import the same modules as `vaultfire.*`.

Python import resolution can be case-sensitive, so `import vaultfire` may fail
if only `Vaultfire/` exists. This module turns `vaultfire` into a *package-like*
module by setting `__path__` to point at `Vaultfire/`.

This avoids relying on `sitecustomize` auto-import behavior, which can vary in
sandboxed runners.
"""

from __future__ import annotations

from pathlib import Path

_VAULTFIRE_DIR = (Path(__file__).resolve().parent / "Vaultfire").resolve()

# Treat this module as a namespace package rooted at ./Vaultfire
__path__ = [str(_VAULTFIRE_DIR)]  # type: ignore[name-defined]
