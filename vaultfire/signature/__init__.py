"""Signature utilities for encoding Ghostprint identity metadata.

This module provides a lightweight in-memory coordination layer that mirrors
the behavior described in the Vaultfire Ghostprint activation checklist.  The
goal is not to reach into any external systems but to offer deterministic,
test-friendly state that other components (CLI tools, test harnesses, etc.)
can query to confirm that identity binding and module fingerprinting have
occurred.

The API intentionally mirrors the activation script shared with the
repository:

* :func:`Ghostprint.bind_identity` associates an identity handle with the
  running protocol and records the operation.
* :func:`Ghostprint.encode_all` attaches deterministic fingerprints to the
  supplied module names.
* :func:`Ghostprint.link_origin` ties the activation to a lineage string.

The helpers return serialisable dictionaries to make it easy for tests to
assert against the behaviour without coupling to internal data structures.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
from typing import Dict, Iterable, Mapping, Sequence

__all__ = ["Ghostprint"]


def _timestamp() -> str:
    """Return a timezone-aware ISO formatted timestamp."""

    return datetime.now(timezone.utc).isoformat()


def _normalise_module(module: object) -> str:
    """Normalise an incoming module reference to a non-empty string."""

    if isinstance(module, str):
        normalised = module.strip()
    else:
        normalised = str(module).strip()
    if not normalised:
        raise ValueError("module identifier cannot be empty")
    return normalised


@dataclass(frozen=True)
class _EncodedModule:
    module: str
    fingerprint: str
    encoded_at: str

    def to_payload(self) -> Mapping[str, str]:
        return {
            "module": self.module,
            "fingerprint": self.fingerprint,
            "encoded_at": self.encoded_at,
        }


class Ghostprint:
    """In-memory signature state container for Ghostkey activations."""

    _identity: Mapping[str, str] | None = None
    _origin_lineage: str | None = None
    _encoded_modules: Dict[str, _EncodedModule] = {}
    _history: list[Mapping[str, object]] = []

    @classmethod
    def reset(cls) -> None:
        """Reset stored state.  Primarily used in tests."""

        cls._identity = None
        cls._origin_lineage = None
        cls._encoded_modules = {}
        cls._history = []

    @classmethod
    def bind_identity(
        cls,
        *,
        wallet: str,
        tag: str,
        ENS: str,
    ) -> Mapping[str, str]:
        """Bind the Ghostprint identity to a wallet/tag/ENS triple."""

        wallet_id = str(wallet).strip()
        if not wallet_id:
            raise ValueError("wallet cannot be empty")
        tag_id = str(tag).strip()
        if not tag_id:
            raise ValueError("tag cannot be empty")
        ens_handle = str(ENS).strip()
        if not ens_handle:
            raise ValueError("ENS cannot be empty")
        payload = {
            "wallet": wallet_id,
            "tag": tag_id,
            "ens": ens_handle,
            "bound_at": _timestamp(),
        }
        cls._identity = payload
        cls._history.append({
            "type": "bind_identity",
            "timestamp": payload["bound_at"],
            "payload": dict(payload),
        })
        return dict(payload)

    @classmethod
    def encode_all(
        cls,
        modules: Iterable[object],
        *,
        include_timestamp: bool = True,
    ) -> Sequence[Mapping[str, str]]:
        """Attach fingerprints to the provided module identifiers."""

        modules = tuple(modules)
        if not modules:
            raise ValueError("modules cannot be empty")
        wallet = (cls._identity or {}).get("wallet", "unbound")
        tag = (cls._identity or {}).get("tag", "ghost")
        encoded: list[Mapping[str, str]] = []
        for raw_module in modules:
            module_name = _normalise_module(raw_module)
            fingerprint_source = f"{module_name}::{wallet}::{tag}".encode("utf-8")
            fingerprint = hashlib.sha256(fingerprint_source).hexdigest()
            encoded_at = _timestamp() if include_timestamp else ""
            module_record = _EncodedModule(
                module=module_name,
                fingerprint=fingerprint,
                encoded_at=encoded_at,
            )
            cls._encoded_modules[module_name] = module_record
            encoded.append(module_record.to_payload())
        cls._history.append({
            "type": "encode_modules",
            "timestamp": _timestamp(),
            "modules": tuple(record["module"] for record in encoded),
        })
        return tuple(encoded)

    @classmethod
    def link_origin(cls, lineage: str) -> Mapping[str, str]:
        """Associate the Ghostprint activation with a lineage string."""

        lineage_text = str(lineage).strip()
        if not lineage_text:
            raise ValueError("lineage cannot be empty")
        timestamp = _timestamp()
        cls._origin_lineage = lineage_text
        cls._history.append(
            {
                "type": "link_origin",
                "timestamp": timestamp,
                "lineage": lineage_text,
            }
        )
        return {"lineage": lineage_text, "linked_at": timestamp}

    @classmethod
    def encoded_modules(cls) -> Sequence[Mapping[str, str]]:
        """Return encoded modules as serialisable payloads."""

        return tuple(module.to_payload() for module in cls._encoded_modules.values())

    @classmethod
    def history(cls) -> Sequence[Mapping[str, object]]:
        """Return the recorded operation history."""

        return tuple(dict(entry) for entry in cls._history)

    @classmethod
    def status(cls) -> Mapping[str, object]:
        """Return a summary of the Ghostprint activation state."""

        identity = dict(cls._identity) if cls._identity else None
        modules = cls.encoded_modules()
        return {
            "identity": identity,
            "modules": modules,
            "origin": cls._origin_lineage,
            "identity_bound": identity is not None,
            "modules_encoded": bool(modules),
            "origin_linked": bool(cls._origin_lineage),
            "history": cls.history(),
        }

