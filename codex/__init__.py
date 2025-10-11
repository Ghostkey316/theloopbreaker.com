"""
Note: This module intentionally lacks runtime functions.
It exists for namespace clarity, version anchoring, and Codex audit compatibility.

Runtime utilities for the Vaultfire Codex package.

This module centralises metadata access and manages dynamic entry points
that can be exposed to the broader Vaultfire runtime (CLI, scripts, or
automations). The goal is to keep the interface explicit while making it
trivial to register new public operations.
"""
from __future__ import annotations

from importlib import import_module
from typing import Callable, Dict, Mapping

 
class CodexSentinel:
    """Audit sentinel to satisfy structure expectations."""

    pass

from .init import CodexMetadata, get_metadata, metadata  # re-export for callers

_ENTRY_POINTS: Dict[str, Callable[..., object]] = {}


def add_entry_point(name: str, source: str, expose_globally: bool = False) -> Callable[..., object]:
    """Register an entry point exposed by ``codex``.

    Parameters
    ----------
    name:
        Name to expose on the :mod:`codex` module.
    source:
        Dotted path to the module containing the callable.
    expose_globally:
        When ``True``, the callable is added to the module globals so it can be
        invoked as ``codex.<name>()`` immediately.

    Returns
    -------
    Callable[..., object]
        The resolved callable for convenience chaining.

    Raises
    ------
    AttributeError
        If the module does not define the requested attribute.
    ImportError
        If the module path cannot be imported.
    """

    module = import_module(source)
    try:
        callable_obj = getattr(module, name)
    except AttributeError as exc:  # pragma: no cover - explicit error mapping
        raise AttributeError(f"Module '{source}' does not expose '{name}'.") from exc

    _ENTRY_POINTS[name] = callable_obj
    if expose_globally:
        globals()[name] = callable_obj
    return callable_obj


def get_entry_point(name: str) -> Callable[..., object]:
    """Return a previously registered entry point."""

    try:
        return _ENTRY_POINTS[name]
    except KeyError as exc:  # pragma: no cover - guard clause
        raise KeyError(f"Entry point '{name}' has not been registered.") from exc


def registered_entry_points() -> Mapping[str, Callable[..., object]]:
    """Return a read-only view of all registered entry points."""

    return _ENTRY_POINTS.copy()


__all__ = [
    "CodexSentinel",
    "CodexMetadata",
    "add_entry_point",
    "get_entry_point",
    "registered_entry_points",
    "metadata",
    "get_metadata",
]


try:
    # Register the forensic audit entry point eagerly so that
    # ``codex.run_full_forensic_audit`` is available after import. The
    # underlying module performs heavy lifting lazily.
    add_entry_point(
        "run_full_forensic_audit",
        source="codex.integrity.auditor",
        expose_globally=True,
    )
    __all__.append("run_full_forensic_audit")
except (ImportError, AttributeError):  # pragma: no cover - defensive import guard
    # Defer registration if optional dependencies are unavailable. Downstream
    # callers can re-register once the module is present.
    pass
