"""Configuration helpers for Vaultfire deployments."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable

_DEFAULT_ENVIRONMENT = "pilot"
_ALLOWED_ENVIRONMENTS: Iterable[str] = ("pilot", "staging", "production")


@dataclass(frozen=True)
class VaultfireEnvironment:
    """Represents the runtime environment for Vaultfire services."""

    name: str

    def __post_init__(self) -> None:
        if self.name not in _ALLOWED_ENVIRONMENTS:
            raise ValueError(
                f"Unsupported Vaultfire environment: {self.name}. "
                f"Expected one of: {', '.join(_ALLOWED_ENVIRONMENTS)}"
            )

    def __str__(self) -> str:  # pragma: no cover - dataclass convenience
        return self.name


def _detect_environment() -> VaultfireEnvironment:
    env = os.getenv("VAULTFIRE_ENV", _DEFAULT_ENVIRONMENT).strip().lower()
    if not env:
        env = _DEFAULT_ENVIRONMENT
    return VaultfireEnvironment(env)


VAULTFIRE_ENV = _detect_environment()

__all__ = ["VAULTFIRE_ENV", "VaultfireEnvironment"]
