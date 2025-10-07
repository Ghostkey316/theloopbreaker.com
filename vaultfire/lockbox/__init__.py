"""Truth lockbox utilities for Vaultfire defenses."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Mapping, MutableMapping, Sequence

__all__ = ["LockboxPackage", "EthicCore", "MemoryVault", "TruthSeal"]


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fingerprint(payload: Mapping[str, object]) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _normalize_keys(keys: Iterable[str]) -> Sequence[str]:
    unique: MutableMapping[str, None] = {}
    for key in keys:
        key = str(key).strip()
        if not key:
            continue
        unique.setdefault(key, None)
    return tuple(unique.keys())


@dataclass
class LockboxPackage:
    """Serializable description of a sealed lockbox package."""

    module: str
    status: str
    payload: MutableMapping[str, object] = field(default_factory=dict)
    sealed_at: str = field(init=False)
    fingerprint: str = field(init=False)

    def __post_init__(self) -> None:
        self.module = str(self.module)
        self.status = str(self.status)
        normalized: MutableMapping[str, object] = {}
        for key, value in dict(self.payload).items():
            if key == "keys" and isinstance(value, Iterable) and not isinstance(value, (str, bytes)):
                normalized[key] = _normalize_keys(value)
            else:
                normalized[key] = value
        self.payload = normalized
        self.sealed_at = _timestamp()
        self.fingerprint = _fingerprint({"module": self.module, **self.payload})

    def to_payload(self) -> Mapping[str, object]:
        payload: MutableMapping[str, object] = {
            "module": self.module,
            "status": self.status,
            "sealed_at": self.sealed_at,
            "payload": dict(self.payload),
            "fingerprint": self.fingerprint,
        }
        if "keys" in self.payload:
            payload["keys"] = tuple(self.payload["keys"])
        return payload


class _BaseLockboxModule:
    module_name: str = "lockbox"

    @classmethod
    def _package(cls, *, status: str = "sealed", **payload: object) -> LockboxPackage:
        return LockboxPackage(module=cls.module_name, status=status, payload=payload)


class EthicCore(_BaseLockboxModule):
    """Locks architect identity and ethics charter references."""

    module_name = "ethic-core"

    @classmethod
    def seal(
        cls,
        *,
        identity: str,
        charter: str = "ghostkey-ethics",
        integrity_vector: Sequence[str] = ("alignment", "consent", "transparency"),
    ) -> LockboxPackage:
        normalized_identity = str(identity)
        payload = {
            "identity": normalized_identity,
            "charter": str(charter),
            "integrity_vector": tuple(str(value) for value in integrity_vector),
            "signature": _fingerprint({"identity": normalized_identity, "charter": str(charter)}),
        }
        return cls._package(**payload)


class MemoryVault(_BaseLockboxModule):
    """Wraps long-term memory artifacts with controlled decay."""

    module_name = "memory-vault"

    @classmethod
    def wrap(
        cls,
        *,
        source: str,
        decay: str,
        retention_cycles: int = 3,
        access_scope: Sequence[str] = ("beliefloop", "mission"),
    ) -> LockboxPackage:
        payload = {
            "source": str(source),
            "decay": str(decay),
            "retention_cycles": int(retention_cycles),
            "access_scope": tuple(str(value) for value in access_scope),
        }
        return cls._package(**payload)


class TruthSeal(_BaseLockboxModule):
    """Encrypts canonical truth keys for mission-critical access."""

    module_name = "truth-seal"

    @classmethod
    def encrypt(
        cls,
        *,
        keys: Sequence[str],
        algorithm: str = "aes-256-gcm",
        rotation: str = "purpose-triggered",
    ) -> LockboxPackage:
        normalized_keys = _normalize_keys(keys)
        payload = {
            "keys": normalized_keys,
            "algorithm": str(algorithm),
            "rotation": str(rotation),
            "checksum": _fingerprint({"keys": normalized_keys, "algorithm": str(algorithm)}),
        }
        return cls._package(**payload)

