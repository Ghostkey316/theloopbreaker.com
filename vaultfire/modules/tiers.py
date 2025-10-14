"""Module tier registry bridging onboarding scopes."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from importlib import resources
from typing import Iterable, Mapping

_MODULE_FILE = "module_tiers.json"
_CORE_KEY = "core"
_OPTIONAL_KEY = "optional"
_ADVANCED_KEY = "advanced"

LITE_MODE = "lite"
FULL_STACK_MODE = "full_stack"
SUPPORTED_MODES: tuple[str, ...] = (LITE_MODE, FULL_STACK_MODE)


@dataclass(frozen=True)
class ModuleInfo:
    """Normalized module descriptor tracked by the registry."""

    name: str
    status: str
    description: str

    def as_dict(self) -> Mapping[str, str]:
        """Serialize the module descriptor for downstream JSON callers."""

        return {"name": self.name, "status": self.status, "description": self.description}


@lru_cache(maxsize=1)
def _load_registry() -> Mapping[str, tuple[ModuleInfo, ...]]:
    package_root = resources.files("vaultfire")
    payload = json.loads(package_root.joinpath(_MODULE_FILE).read_text(encoding="utf-8"))
    registry: dict[str, tuple[ModuleInfo, ...]] = {}
    for tier, modules in payload.items():
        registry[tier] = tuple(
            ModuleInfo(
                name=str(entry.get("name", "")),
                status=str(entry.get("status", "pending_audit")),
                description=str(entry.get("description", "")),
            )
            for entry in modules
        )
    return registry


def list_modules_by_tier(tier: str) -> tuple[ModuleInfo, ...]:
    """Return ordered modules for ``tier`` raising ``KeyError`` on unknown tiers."""

    normalized = tier.strip().lower()
    registry = _load_registry()
    if normalized not in registry:
        raise KeyError(f"Unknown tier {tier!r}")
    return registry[normalized]


def flatten_modules(tiers: Iterable[str]) -> tuple[ModuleInfo, ...]:
    """Flatten ``tiers`` into a tuple of unique ``ModuleInfo`` items preserving order."""

    seen: set[str] = set()
    ordered: list[ModuleInfo] = []
    for tier in tiers:
        for module in list_modules_by_tier(tier):
            if module.name in seen:
                continue
            ordered.append(module)
            seen.add(module.name)
    return tuple(ordered)


def get_modules_for_mode(mode: str) -> tuple[ModuleInfo, ...]:
    """Return module descriptors for the requested onboarding mode."""

    normalized = mode.strip().lower()
    if normalized not in SUPPORTED_MODES:
        raise KeyError(f"Unknown onboarding mode {mode!r}")
    if normalized == LITE_MODE:
        return list_modules_by_tier(_CORE_KEY)
    return flatten_modules((_CORE_KEY, _OPTIONAL_KEY, _ADVANCED_KEY))


__all__ = [
    "ModuleInfo",
    "SUPPORTED_MODES",
    "LITE_MODE",
    "FULL_STACK_MODE",
    "list_modules_by_tier",
    "flatten_modules",
    "get_modules_for_mode",
]
