# Reference: ethics/core.mdx
"""Vaultfire engine package.

Why this file is intentionally small
-----------------------------------
Some execution environments (task runners, sandboxes, CI probes) import
`engine.*` modules via `python -m engine.<module>`.

Historically `engine/__init__.py` eagerly imported a very large surface area.
That caused *unrelated* optional dependencies (e.g. `cryptography`) to become
hard requirements even when callers only wanted a single lightweight module
like `engine.passive_yield_simulator`.

To better fit the Vaultfire mission (resilience, least surprise, minimal
privileged/optional dependencies), we keep `engine` import side-effects near
zero and provide a small lazy export surface.

If you need other engine modules, import them directly:
  - `from engine import loyalty_score`
  - `from engine.passive_yield_simulator import simulate_passive_yield`
"""

from __future__ import annotations

import importlib
from typing import Any


# Minimal, stable exports used by task runners + demos.
__all__ = [
    "loyalty_score",
    "update_loyalty_ranks",
    "simulate_passive_yield",
]


_LAZY: dict[str, tuple[str, str]] = {
    "loyalty_score": ("engine.loyalty_engine", "loyalty_score"),
    "update_loyalty_ranks": ("engine.loyalty_engine", "update_loyalty_ranks"),
    "simulate_passive_yield": ("engine.passive_yield_simulator", "simulate_passive_yield"),
}


def __getattr__(name: str) -> Any:  # pragma: no cover
    target = _LAZY.get(name)
    if not target:
        raise AttributeError(name)
    module_name, attr = target
    module = importlib.import_module(module_name)
    value = getattr(module, attr)
    globals()[name] = value
    return value
