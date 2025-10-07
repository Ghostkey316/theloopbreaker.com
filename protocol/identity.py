"""Identity utilities for Vaultfire trial activation."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Dict, Mapping, Tuple

__all__ = ["IdentityRecord", "IdentityManager"]


@dataclass(frozen=True)
class IdentityRecord:
    """Immutable representation of a Vaultfire identity."""

    address: str
    alias: str
    tags: Tuple[str, ...]
    metadata: Mapping[str, Any]
    default_wallet_id: str
    default_trial_codename: str
    _fingerprint: str

    def fingerprint(self) -> str:
        payload = {
            "address": self.address,
            "alias": self.alias,
            "tags": list(self.tags),
            "metadata": dict(self.metadata),
            "default_wallet_id": self.default_wallet_id,
            "default_trial_codename": self.default_trial_codename,
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def verify_immutability(self) -> bool:
        """Return ``True`` when the record fingerprint matches the stored value."""

        return self._fingerprint == self.fingerprint()

    @property
    def ens(self) -> str:
        """Return the ENS handle associated with the identity."""

        return str(self.metadata.get("ens", self.address))

    def as_dict(self) -> Dict[str, Any]:  # pragma: no cover - convenience helper
        return {
            "address": self.address,
            "alias": self.alias,
            "tags": list(self.tags),
            "metadata": dict(self.metadata),
            "default_wallet_id": self.default_wallet_id,
            "default_trial_codename": self.default_trial_codename,
        }


def _compute_fingerprint(payload: Mapping[str, Any]) -> str:
    serialized = json.dumps(dict(payload), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class IdentityManager:
    """Loader for static identity records used during the Golden Trial."""

    _REGISTRY: Dict[str, Dict[str, Any]] = {
        "ghostkey316.eth": {
            "address": "0xghostkey316",
            "alias": "Ghostkey Architect",
            "tags": ("architect", "guardian"),
            "metadata": {
                "ens": "ghostkey316.eth",
                "beacon": "golden_trial",
                "telemetry_scope": "liveflow",
            },
            "default_wallet_id": "bpow20.cb.id",
            "default_trial_codename": "Golden Trial Liveflow",
        }
    }
    _CACHE: Dict[str, IdentityRecord] = {}

    @classmethod
    def load(cls, handle: str) -> IdentityRecord:
        handle_str = str(handle).strip()
        if not handle_str:
            raise ValueError("handle must be a non-empty string")

        if handle_str in cls._CACHE:
            return cls._CACHE[handle_str]

        try:
            record = cls._REGISTRY[handle_str]
        except KeyError as exc:  # pragma: no cover - defensive branch
            raise ValueError(f"Unknown identity handle '{handle_str}'") from exc

        metadata_proxy = MappingProxyType(dict(record["metadata"]))
        payload = {
            "address": record["address"],
            "alias": record["alias"],
            "tags": list(record.get("tags", ())),
            "metadata": dict(metadata_proxy),
            "default_wallet_id": record["default_wallet_id"],
            "default_trial_codename": record["default_trial_codename"],
        }
        fingerprint = _compute_fingerprint(payload)

        identity = IdentityRecord(
            address=record["address"],
            alias=record["alias"],
            tags=tuple(record.get("tags", ())),
            metadata=metadata_proxy,
            default_wallet_id=record["default_wallet_id"],
            default_trial_codename=record["default_trial_codename"],
            _fingerprint=fingerprint,
        )
        cls._CACHE[handle_str] = identity
        return identity
