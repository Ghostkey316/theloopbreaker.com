"""Vaultfire helper package with lazy module loading.

Many Vaultfire modules rely on optional integrations. To keep imports
resilient in constrained environments we lazily load submodules when they
are first accessed.
"""

from __future__ import annotations

import importlib
from typing import Any, Dict, Iterable

__all__ = [
    "echo",
    "growth",
    "satellite",
    "enterprise",
    "rewards",
    "ghost_audit",
    "refund",
    "pilot_mode",
    "telemetry",
    "auto_refund",
    "should_refund",
    "freeze_refunds",
    "unfreeze_refunds",
    "is_frozen",
]

_LAZY_MODULES: Dict[str, str] = {
    "echo": ".echo",
    "growth": ".growth",
    "satellite": ".satellite",
    "enterprise": ".enterprise",
    "rewards": ".rewards",
    "ghost_audit": ".ghost_audit",
    "refund": ".refund",
    "pilot_mode": ".pilot_mode",
    "telemetry": ".telemetry",
}

_REFUND_EXPORTS: Iterable[str] = (
    "auto_refund",
    "should_refund",
    "freeze_refunds",
    "unfreeze_refunds",
    "is_frozen",
)


def __getattr__(name: str) -> Any:
    if name in _LAZY_MODULES:
        module = importlib.import_module(_LAZY_MODULES[name], __name__)
        globals()[name] = module
        return module
    if name in _REFUND_EXPORTS:
        refund_module = importlib.import_module(".refund", __name__)
        value = getattr(refund_module, name)
        globals()[name] = value
        return value
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> Iterable[str]:
    return sorted(set(__all__))
