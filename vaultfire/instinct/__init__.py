"""Lightweight instinct engine primitives for Vaultfire integrations."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Mapping, MutableMapping, Optional, Sequence

__all__ = [
    "InstinctSignal",
    "ReflexShield",
    "VibeSense",
    "PredictivePulse",
    "TrustGauge",
    "InstinctSuite",
]


def _timestamp() -> str:
    """Return an ISO-8601 timestamp in UTC."""

    return datetime.now(timezone.utc).isoformat()


@dataclass
class InstinctSignal:
    """Structured state shared by instinct modules."""

    module: str
    status: str
    config: MutableMapping[str, object] = field(default_factory=dict)
    capabilities: Sequence[str] = field(default_factory=tuple)
    heartbeat: str = field(init=False)
    annotations: MutableMapping[str, object] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.module = str(self.module)
        self.status = str(self.status)
        self.config = dict(self.config)
        self.capabilities = tuple(self.capabilities)
        self.annotations = dict(self.annotations)
        self.heartbeat = _timestamp()

    def touch(self, *, status: Optional[str] = None) -> None:
        """Refresh the heartbeat and optionally update status."""

        if status is not None:
            self.status = str(status)
        self.heartbeat = _timestamp()

    def to_payload(self) -> Dict[str, object]:
        """Serialize the instinct state for external systems."""

        payload: Dict[str, object] = {
            "module": self.module,
            "status": self.status,
            "config": dict(self.config),
            "heartbeat": self.heartbeat,
        }
        if self.capabilities:
            payload["capabilities"] = tuple(self.capabilities)
        if self.annotations:
            payload["annotations"] = dict(self.annotations)
        return payload


class _BaseInstinctModule:
    """Common helpers for the instinct primitives."""

    module_name: str = "instinct"
    default_status: str = "active"
    default_capabilities: Sequence[str] = ()

    @classmethod
    def _build_signal(
        cls,
        *,
        status: Optional[str] = None,
        capabilities: Optional[Sequence[str]] = None,
        annotations: Optional[Mapping[str, object]] = None,
        **config: object,
    ) -> InstinctSignal:
        signal = InstinctSignal(
            module=cls.module_name,
            status=status or cls.default_status,
            config={k: v for k, v in config.items()},
            capabilities=capabilities if capabilities is not None else cls.default_capabilities,
            annotations=dict(annotations or {}),
        )
        signal.touch()  # ensure a fresh heartbeat on creation
        return signal


class ReflexShield(_BaseInstinctModule):
    """Protective layer that reacts to incoming volatility."""

    module_name = "reflex"
    default_capabilities = ("threat-filter", "auto-escalate")

    @classmethod
    def activate(
        cls,
        *,
        threshold: str = "autoprotect",
        dampening: float = 0.85,
    ) -> InstinctSignal:
        return cls._build_signal(
            status="active",
            threshold=str(threshold),
            dampening=float(dampening),
            latency="instant",
        )


class VibeSense(_BaseInstinctModule):
    """Ambient signal listener for Vaultfire inputs."""

    module_name = "vibe"
    default_capabilities = ("ambient-scan", "signal-diffusion")

    @classmethod
    def listen(
        cls,
        *,
        scope: str = "input_streams",
        sensitivity: float = 0.72,
    ) -> InstinctSignal:
        return cls._build_signal(
            status="listening",
            scope=str(scope),
            sensitivity=float(sensitivity),
            latency="low",
        )


class PredictivePulse(_BaseInstinctModule):
    """Predictive ping loop to anticipate protocol state shifts."""

    module_name = "predict"
    default_capabilities = ("pattern-detect", "stability-forecast")

    @classmethod
    def scan(
        cls,
        *,
        interval: str = "1.25s",
        horizon: int = 5,
    ) -> InstinctSignal:
        return cls._build_signal(
            status="scanning",
            interval=str(interval),
            horizon=int(horizon),
            latency="scheduled",
        )


class TrustGauge(_BaseInstinctModule):
    """Confidence measurement seeded with Vaultfire memory."""

    module_name = "trust"
    default_capabilities = ("consensus-eval", "belief-trace")

    @classmethod
    def bootstrap(
        cls,
        *,
        seed: str = "VaultfireProtocolHistory",
        baseline: float = 0.9,
    ) -> InstinctSignal:
        return cls._build_signal(
            status="stabilized",
            seed=str(seed),
            baseline=float(baseline),
            latency="historical",
        )


_VALID_STATUSES = {
    "active",
    "listening",
    "scanning",
    "stabilized",
    "engaged",
    "ready",
}


class InstinctSuite:
    """Validation helper ensuring instinct stacks meet minimum guarantees."""

    _attached_stack: Dict[str, Mapping[str, object]] = {}
    _history: List[Mapping[str, object]] = []

    @classmethod
    def attach(cls, modules: Mapping[str, object]) -> Dict[str, Mapping[str, object]]:
        if not modules:
            raise ValueError("instinct modules payload cannot be empty")
        normalized = cls._normalize_stack(modules)
        cls._attached_stack = normalized
        cls._history.append({
            "attached_at": _timestamp(),
            "modules": tuple(sorted(normalized)),
        })
        return cls.snapshot()

    @classmethod
    def snapshot(cls) -> Dict[str, Mapping[str, object]]:
        return {name: dict(payload) for name, payload in cls._attached_stack.items()}

    @classmethod
    def history(cls) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in cls._history)

    @classmethod
    def clear(cls) -> None:
        cls._attached_stack = {}
        cls._history.clear()

    @classmethod
    def run_all(
        cls,
        modules: Optional[Mapping[str, object]] = None,
    ) -> Mapping[str, object]:
        stack = cls._normalize_stack(modules or cls._attached_stack)
        if not stack:
            raise ValueError("No instinct modules have been registered")
        report: Dict[str, object] = {
            "checked_at": _timestamp(),
            "modules": {},
            "passed": True,
        }
        for name, payload in stack.items():
            cls._validate_payload(name, payload)
            module_report = {
                "status": payload["status"],
                "heartbeat": payload["heartbeat"],
            }
            if isinstance(payload.get("config"), Mapping):
                module_report["config"] = dict(payload["config"])
            report["modules"][name] = module_report
        return report

    @classmethod
    def _normalize_stack(
        cls,
        modules: Mapping[str, object],
    ) -> Dict[str, Dict[str, object]]:
        normalized: Dict[str, Dict[str, object]] = {}
        for name, module in modules.items():
            payload = cls._coerce_module(name, module)
            normalized[name] = payload
        return normalized

    @staticmethod
    def _coerce_module(name: str, module: object) -> Dict[str, object]:
        if isinstance(module, InstinctSignal):
            payload = module.to_payload()
        elif hasattr(module, "to_payload") and callable(module.to_payload):  # type: ignore[attr-defined]
            payload = module.to_payload()  # type: ignore[assignment]
        elif isinstance(module, Mapping):
            payload = dict(module)
        else:
            raise TypeError(
                f"Unsupported instinct module type for '{name}': {type(module)!r}"
            )
        payload.setdefault("module", name)
        payload.setdefault("config", {})
        payload.setdefault("status", "ready")
        payload.setdefault("heartbeat", _timestamp())
        payload["module"] = str(payload["module"])
        payload["status"] = str(payload["status"])
        payload["heartbeat"] = str(payload["heartbeat"])
        if not isinstance(payload["config"], Mapping):
            payload["config"] = {"value": payload["config"]}
        else:
            payload["config"] = dict(payload["config"])
        return payload

    @staticmethod
    def _validate_payload(name: str, payload: Mapping[str, object]) -> None:
        required_fields = ("module", "status", "heartbeat", "config")
        for field in required_fields:
            if field not in payload:
                raise ValueError(
                    f"Instinct module '{name}' is missing required field '{field}'"
                )
        status = str(payload["status"])
        if status not in _VALID_STATUSES:
            raise ValueError(
                f"Instinct module '{name}' returned unsupported status '{status}'"
            )
        heartbeat = str(payload["heartbeat"])
        if "T" not in heartbeat:
            raise ValueError(
                f"Instinct module '{name}' heartbeat must be ISO-8601 formatted"
            )
        if not isinstance(payload.get("config"), Mapping):
            raise ValueError(
                f"Instinct module '{name}' config must be a mapping"
            )
        if payload.get("module") != name:
            # keep modules names consistent so downstream logs are predictable
            raise ValueError(
                f"Instinct module '{name}' reported mismatched identity"
            )
