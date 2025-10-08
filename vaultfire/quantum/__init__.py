"""Quantum mirror integration helpers.

This module provides a small API that records how a Quantum Mirror module
is stitched into a Vaultfire deployment. Integrations are stored in a JSON
registry so operational tooling can look up the active configuration without
having to speak directly to the orchestrator. Example::

    from vaultfire.quantum import integrate_quantum_mirror_module

    integrate_quantum_mirror_module(
        identity="Ghostkey-316",
        wallet="bpow20.cb.id",
        modules=["Belief-Time Causality Sync"],
        fallback_protection="Anti-Temporal Drift Protocol",
        visibility="stealth",
        compute_scaling="auto",
        early_warning_system=True,
    )

The registry lives in ``status/quantum_mirror_integrations.json`` by default,
though the location can be overridden via the
``VAULTFIRE_QUANTUM_MIRROR_PATH`` environment variable. Each entry is keyed by
identity so repeated calls update the latest configuration instead of
creating duplicate rows.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Sequence

__all__ = [
    "append_protocol_module",
    "integrate_quantum_mirror_module",
    "QuantumMirrorIntegrationError",
]

_REGISTRY_PATH_ENV = "VAULTFIRE_QUANTUM_MIRROR_PATH"
_ALLOWED_VISIBILITY: Mapping[str, str] = {
    "stealth": "stealth",
    "internal": "internal",
    "partner": "partner",
    "public": "public",
}
_ALLOWED_COMPUTE_SCALING: Mapping[str, str] = {
    "auto": "auto",
    "manual": "manual",
    "scheduled": "scheduled",
    "hybrid": "hybrid",
}


class QuantumMirrorIntegrationError(ValueError):
    """Raised when integration parameters fail validation."""


@dataclass
class _QuantumMirrorRecord:
    identity: str
    wallet: str
    modules: list[str]
    fallback_protection: str
    visibility: str
    compute_scaling: str
    early_warning_system: bool
    status: str
    integrated_at: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _current_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_text(name: str, value: Any) -> str:
    if not isinstance(value, str):
        raise QuantumMirrorIntegrationError(f"{name} must be a string")
    trimmed = value.strip()
    if not trimmed:
        raise QuantumMirrorIntegrationError(f"{name} cannot be empty")
    return trimmed


def _ensure_iterable(name: str, value: Any) -> Iterable[Any]:
    if isinstance(value, (str, bytes)):
        raise QuantumMirrorIntegrationError(f"{name} must be a sequence of values")
    if not isinstance(value, Iterable):
        raise QuantumMirrorIntegrationError(f"{name} must be iterable")
    return value


def _normalize_modules(modules: Any) -> list[str]:
    values = []
    for raw in _ensure_iterable("modules", modules):
        if not isinstance(raw, str):
            raise QuantumMirrorIntegrationError("modules entries must be strings")
        trimmed = raw.strip()
        if not trimmed:
            raise QuantumMirrorIntegrationError("modules entries cannot be empty")
        if trimmed not in values:
            values.append(trimmed)
    if not values:
        raise QuantumMirrorIntegrationError("modules must contain at least one entry")
    return values


def _normalize_choice(name: str, value: Any, allowed: Mapping[str, str]) -> str:
    if not isinstance(value, str):
        raise QuantumMirrorIntegrationError(f"{name} must be a string")
    normalized = value.strip().lower()
    if normalized not in allowed:
        valid = ", ".join(sorted(allowed))
        raise QuantumMirrorIntegrationError(f"{name} must be one of: {valid}")
    return allowed[normalized]


def _ensure_bool(name: str, value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    raise QuantumMirrorIntegrationError(f"{name} must be a boolean value")


def _get_registry_path() -> Path:
    custom = os.getenv(_REGISTRY_PATH_ENV)
    if custom:
        return Path(custom)
    return Path("status") / "quantum_mirror_integrations.json"


def _load_registry(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}
    if isinstance(data, dict):
        return data
    return {}


def _write_registry(path: Path, registry: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(registry), indent=2) + "\n")


def _normalise_impact(impact: Sequence[str]) -> list[str]:
    values: list[str] = []
    for raw in _ensure_iterable("impact", impact):
        if not isinstance(raw, str):
            raise QuantumMirrorIntegrationError("impact entries must be strings")
        trimmed = raw.strip()
        if not trimmed:
            raise QuantumMirrorIntegrationError("impact entries cannot be empty")
        if trimmed not in values:
            values.append(trimmed)
    if not values:
        raise QuantumMirrorIntegrationError("impact must contain at least one entry")
    return values


def append_protocol_module(
    *,
    module_name: str,
    description: str,
    source_context: str,
    impact: Sequence[str],
    registry_path: str | Path | None = None,
) -> Dict[str, Any]:
    """Record an entangled quantum module for operational visibility."""

    normalized_name = _ensure_text("module_name", module_name)
    normalized_description = _ensure_text("description", description)
    normalized_context = _ensure_text("source_context", source_context)
    normalized_impact = _normalise_impact(impact)

    record = {
        "module_name": normalized_name,
        "description": normalized_description,
        "source_context": normalized_context,
        "impact": normalized_impact,
        "registered_at": _current_timestamp(),
    }
    record["entanglement_hash"] = sha256(
        json.dumps(record, sort_keys=True).encode("utf-8")
    ).hexdigest()

    path = Path(registry_path) if registry_path else Path("status") / "quantum_entanglement_modules.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    return record


def integrate_quantum_mirror_module(
    *,
    identity: str,
    wallet: str,
    modules: Sequence[str],
    fallback_protection: str,
    visibility: str,
    compute_scaling: str,
    early_warning_system: bool,
) -> Dict[str, Any]:
    """Register or update a Quantum Mirror module integration.

    Parameters
    ----------
    identity:
        Unique identifier for the partner or shard being synchronized.
    wallet:
        Wallet or credential reference tied to the integration.
    modules:
        Human-readable module names that make up the mirror stack.
    fallback_protection:
        Name of the resiliency protocol activated as a fail-safe.
    visibility:
        Operational visibility tier. Supported values are "stealth",
        "internal", "partner", and "public".
    compute_scaling:
        Scaling strategy applied to the compute layer. Supported values are
        "auto", "manual", "scheduled", and "hybrid".
    early_warning_system:
        Whether anomaly detection signals should be emitted in real time.

    Returns
    -------
    dict
        The normalized record that was persisted to the registry.
    """

    normalized_identity = _ensure_text("identity", identity)
    normalized_wallet = _ensure_text("wallet", wallet)
    normalized_modules = _normalize_modules(modules)
    normalized_fallback = _ensure_text("fallback_protection", fallback_protection)
    normalized_visibility = _normalize_choice("visibility", visibility, _ALLOWED_VISIBILITY)
    normalized_scaling = _normalize_choice("compute_scaling", compute_scaling, _ALLOWED_COMPUTE_SCALING)
    warning_flag = _ensure_bool("early_warning_system", early_warning_system)

    registry_path = _get_registry_path()
    registry = _load_registry(registry_path)

    record = _QuantumMirrorRecord(
        identity=normalized_identity,
        wallet=normalized_wallet,
        modules=normalized_modules,
        fallback_protection=normalized_fallback,
        visibility=normalized_visibility,
        compute_scaling=normalized_scaling,
        early_warning_system=warning_flag,
        status="synchronized",
        integrated_at=_current_timestamp(),
    )

    registry[normalized_identity] = record.to_dict()
    _write_registry(registry_path, registry)
    return record.to_dict()
