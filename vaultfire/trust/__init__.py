"""Trust and provenance tracking helpers for Vaultfire stacks."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Mapping, MutableSequence, Sequence

from .markers import record_protocol_markers
from .proof_of_reserve import verify_reserve
from .ccip import (
    broadcast_belief_cross_chain,
    check_ccip_status,
    sync_identity_all_chains,
    supported_chains,
)

__all__ = [
    "ProvenanceTracer",
    "record_protocol_markers",
    "verify_reserve",
    "broadcast_belief_cross_chain",
    "check_ccip_status",
    "sync_identity_all_chains",
    "supported_chains",
]


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


class ProvenanceTracer:
    """Maintain provenance traces and royalty conditions."""

    _config: Mapping[str, object] = {}
    _royalty: Mapping[str, str] = {}
    _traces: MutableSequence[Mapping[str, object]] = []
    _history: MutableSequence[Mapping[str, object]] = []

    @classmethod
    def reset(cls) -> None:
        cls._config = {}
        cls._royalty = {}
        cls._traces = []
        cls._history = []

    @classmethod
    def initiate(cls, *, network_scope: str, max_depth: int) -> Mapping[str, object]:
        scope = str(network_scope).strip()
        if not scope:
            raise ValueError("network_scope cannot be empty")
        if max_depth <= 0:
            raise ValueError("max_depth must be positive")
        config = {
            "network_scope": scope,
            "max_depth": int(max_depth),
            "initiated_at": _timestamp(),
        }
        cls._config = config
        cls._history.append({
            "type": "initiate",
            "timestamp": config["initiated_at"],
            "payload": dict(config),
        })
        return dict(config)

    @classmethod
    def set_royalty_conditions(cls, *, trigger: str, method: str) -> Mapping[str, str]:
        if not cls._config:
            raise RuntimeError("ProvenanceTracer must be initiated before configuring royalties")
        trigger_label = str(trigger).strip()
        method_label = str(method).strip()
        if not trigger_label:
            raise ValueError("trigger cannot be empty")
        if not method_label:
            raise ValueError("method cannot be empty")
        payload = {
            "trigger": trigger_label,
            "method": method_label,
            "configured_at": _timestamp(),
        }
        cls._royalty = payload
        cls._history.append({
            "type": "set_royalty",
            "timestamp": payload["configured_at"],
            "payload": dict(payload),
        })
        return dict(payload)

    @classmethod
    def trace(
        cls,
        source: str,
        *,
        weight: float = 1.0,
        depth: int = 0,
        context: Mapping[str, object] | None = None,
    ) -> Mapping[str, object]:
        if not cls._config:
            raise RuntimeError("ProvenanceTracer must be initiated before tracing")
        if depth < 0:
            raise ValueError("depth cannot be negative")
        if depth > int(cls._config.get("max_depth", 0)):
            raise ValueError("depth exceeds configured max_depth")
        label = str(source).strip()
        if not label:
            raise ValueError("source cannot be empty")
        timestamp = _timestamp()
        entry = {
            "source": label,
            "weight": float(weight),
            "depth": int(depth),
            "timestamp": timestamp,
        }
        if context is not None:
            entry["context"] = dict(context)
        cls._traces.append(dict(entry))
        cls._history.append({
            "type": "trace",
            "timestamp": timestamp,
            "payload": dict(entry),
        })
        return dict(entry)

    @classmethod
    def traces(cls) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in cls._traces)

    @classmethod
    def history(cls) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in cls._history)

    @classmethod
    def status(cls) -> Mapping[str, object]:
        return {
            "initialized": bool(cls._config),
            "config": dict(cls._config),
            "royalty": dict(cls._royalty),
            "traces_recorded": len(cls._traces),
            "history": cls.history(),
        }
