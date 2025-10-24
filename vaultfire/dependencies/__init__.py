"""Integration dependency utilities for Vaultfire."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Dict, Mapping

from .refresh import (
    SERVICE_MAP_PATH as _SERVICE_MAP_PATH,
    regenerate_service_artifacts,
    render_service_map,
    render_sla,
)

SERVICE_MAP_PATH = _SERVICE_MAP_PATH

__all__ = [
    "SERVICE_MAP_PATH",
    "check_service_health",
    "load_service_map",
    "ping_service",
    "regenerate_service_artifacts",
    "render_service_map",
    "render_sla",
]


def load_service_map(path: Path | None = None) -> Dict[str, str]:
    """Return the integration service map."""

    target = (path or SERVICE_MAP_PATH).expanduser()
    payload = json.loads(target.read_text(encoding="utf-8"))
    if not isinstance(payload, Mapping):  # pragma: no cover - defensive guard
        raise TypeError("service map must be a mapping")
    return {str(key): str(value) for key, value in payload.items()}


def _is_planned(status: str) -> bool:
    return "planned" in status.lower()


def ping_service(
    service: str,
    status: str,
    *,
    transport: Callable[[str], bool] | None = None,
) -> bool:
    """Probe ``service`` and return ``True`` when healthy."""

    if transport is not None:
        return bool(transport(service))
    normalised = status.lower()
    if _is_planned(normalised):
        return True
    keywords = ("active", "integrated", "secured", "online")
    return any(token in normalised for token in keywords)


def check_service_health(
    *,
    service_map: Mapping[str, str] | None = None,
    probe: Callable[[str], bool] | None = None,
) -> bool:
    """Return ``True`` when all non-planned services report healthy."""

    mapping = dict(service_map or load_service_map())
    for service, status in mapping.items():
        if _is_planned(str(status)):
            continue
        if probe is not None:
            healthy = bool(probe(service))
        else:
            healthy = ping_service(service, str(status))
        if not healthy:
            return False
    return True
