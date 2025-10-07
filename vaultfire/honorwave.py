"""Honorwave Public Honor Layer utilities.

This module provides a tiny, deterministic simulation of the Mirrorwave
public honor surface.  The goal is to make it easy for tests (and the
activation scripts) to configure the layer, ingest existing signatures and
broadcast honour beacons without relying on any remote services.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Mapping


class HonorWaveRegistry:
    """In-memory registry for honor signatures."""

    _signatures: dict[str, "HonorSignature"] = {}

    @classmethod
    def reset(cls) -> None:
        cls._signatures = {}

    @classmethod
    def load_signature(cls, *, source: str, signature: str) -> "HonorSignature":
        if not source or not signature:
            raise ValueError("source and signature must be provided")

        record = HonorSignature(source=source, signature=signature)
        cls._signatures[signature] = record
        Mirrorwave._state.registry[signature] = record
        return record

    @classmethod
    def get(cls, signature: str) -> "HonorSignature | None":
        return cls._signatures.get(signature)

    @classmethod
    def all(cls) -> Iterable["HonorSignature"]:
        return tuple(cls._signatures.values())


@dataclass(frozen=True)
class HonorSignature:
    source: str
    signature: str


@dataclass
class HonorwaveState:
    registry: dict[str, HonorSignature] = field(default_factory=dict)
    config: dict[str, object] = field(default_factory=dict)
    broadcasts: list[dict[str, object]] = field(default_factory=list)
    ui_path: str | None = None
    scorer: dict[str, object] = field(default_factory=dict)

    def snapshot(self) -> dict[str, object]:
        return {
            "registry": {key: value.signature for key, value in self.registry.items()},
            "config": dict(self.config),
            "broadcasts": [dict(entry) for entry in self.broadcasts],
            "ui_path": self.ui_path,
            "scorer": dict(self.scorer),
        }


class Mirrorwave:
    """Coordinator for the honorwave public layer."""

    status: str = "OFFLINE"
    _state = HonorwaveState()

    @classmethod
    def reset(cls) -> None:
        cls.status = "OFFLINE"
        cls._state = HonorwaveState()
        HonorWaveRegistry.reset()

    @classmethod
    def enable_public_layer(
        cls,
        *,
        trust_anchor: str,
        signature_preview: bool,
        live_feed: bool,
        honor_score_visible: bool,
        trail_access: str,
    ) -> Mapping[str, object]:
        if not trust_anchor:
            raise ValueError("trust_anchor must be provided")

        cls._state.config = {
            "trust_anchor": trust_anchor,
            "signature_preview": bool(signature_preview),
            "live_feed": bool(live_feed),
            "honor_score_visible": bool(honor_score_visible),
            "trail_access": trail_access,
        }
        cls.status = "LIVE" if live_feed else "READY"
        cls._state.broadcasts.clear()
        cls._state.ui_path = None
        return cls._state.snapshot()

    @classmethod
    def broadcast(
        cls,
        *,
        from_identity: str,
        message: str,
        tag: Iterable[str],
    ) -> Mapping[str, object]:
        if cls.status != "LIVE":
            raise RuntimeError("Mirrorwave must be live before broadcasting")
        if not from_identity or not message:
            raise ValueError("from_identity and message must be provided")
        entry = {
            "from": from_identity,
            "message": message,
            "tags": tuple(tag),
        }
        cls._state.broadcasts.append(entry)
        return dict(entry)

    @classmethod
    def launch_ui(cls, *, path: str) -> str:
        if not path or not path.startswith("/"):
            raise ValueError("UI path must be an absolute path")
        cls._state.ui_path = path
        return path

    @classmethod
    def snapshot(cls) -> Mapping[str, object]:
        return {
            "status": cls.status,
            **cls._state.snapshot(),
        }


class HonorWaveScorer:
    """Weighted scoring engine state."""

    _weights: Mapping[str, float] = {}
    _sync_target: str | None = None

    @classmethod
    def initialize(
        cls,
        *,
        weight_factors: Mapping[str, float],
        sync_with: str | None = None,
    ) -> Mapping[str, float]:
        if not weight_factors:
            raise ValueError("weight_factors must be provided")

        normalised: dict[str, float] = {}
        total = 0.0
        for key, value in weight_factors.items():
            weight = max(0.0, float(value))
            if weight:
                normalised[key] = weight
                total += weight

        if total == 0.0:
            raise ValueError("at least one weight must be greater than zero")

        for key in list(normalised):
            normalised[key] = normalised[key] / total

        cls._weights = normalised
        cls._sync_target = sync_with
        Mirrorwave._state.scorer = {
            "weights": dict(normalised),
            "sync_with": sync_with,
        }
        return dict(normalised)

    @classmethod
    def weights(cls) -> Mapping[str, float]:
        return dict(cls._weights)

    @classmethod
    def sync_target(cls) -> str | None:
        return cls._sync_target


def activate_module(module_path: str) -> object:
    """Simple helper mirroring the activation DSL used in scripts."""

    if module_path != "vaultfire.honorwave":
        raise ValueError(f"unsupported module: {module_path}")
    return __import__(module_path, fromlist=["*"])


__all__ = [
    "HonorWaveRegistry",
    "HonorSignature",
    "HonorwaveState",
    "HonorWaveScorer",
    "Mirrorwave",
    "activate_module",
]

