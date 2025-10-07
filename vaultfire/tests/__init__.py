"""Utility exports for Vaultfire internal test helpers."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Callable, Dict, Mapping, MutableMapping, Sequence

from vaultfire.align import VectorSync
from vaultfire.instinct import InstinctSuite
from vaultfire.pulse import MissionMonitor
from vaultfire.purpose import EchoPath

__all__ = ["InstinctSuite", "DefenseSuite", "PurposeSuite"]


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


class DefenseSuite:
    """Validation helper orchestrating shield and lockbox defenses."""

    _shield_layers: Dict[str, Mapping[str, object]] = {}
    _lockbox_layers: Dict[str, Mapping[str, object]] = {}
    _history: Sequence[Mapping[str, object]] = ()

    @classmethod
    def clear(cls) -> None:
        cls._shield_layers = {}
        cls._lockbox_layers = {}
        cls._history = ()

    @classmethod
    def register_shield(
        cls, modules: Mapping[str, object]
    ) -> Mapping[str, Mapping[str, object]]:
        if not modules:
            raise ValueError("defense shield payload cannot be empty")
        normalized = cls._normalize(modules, cls._coerce_shield_module)
        cls._shield_layers = {
            name: cls._clone_shield_payload(payload) for name, payload in normalized.items()
        }
        cls._record_history("shield", tuple(sorted(cls._shield_layers)))
        return {
            name: cls._clone_shield_payload(payload)
            for name, payload in cls._shield_layers.items()
        }

    @classmethod
    def register_lockbox(
        cls, packages: Mapping[str, object]
    ) -> Mapping[str, Mapping[str, object]]:
        if not packages:
            raise ValueError("defense lockbox payload cannot be empty")
        normalized = cls._normalize(packages, cls._coerce_lockbox_module)
        cls._lockbox_layers = {
            name: cls._clone_lockbox_payload(payload) for name, payload in normalized.items()
        }
        cls._record_history("lockbox", tuple(sorted(cls._lockbox_layers)))
        return {
            name: cls._clone_lockbox_payload(payload)
            for name, payload in cls._lockbox_layers.items()
        }

    @classmethod
    def snapshot(cls) -> Mapping[str, Mapping[str, object]]:
        return {
            "shield": {
                name: cls._clone_shield_payload(payload)
                for name, payload in cls._shield_layers.items()
            },
            "lockbox": {
                name: cls._clone_lockbox_payload(payload)
                for name, payload in cls._lockbox_layers.items()
            },
        }

    @classmethod
    def history(cls) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in cls._history)

    @classmethod
    def run_all(cls) -> Mapping[str, object]:
        if not cls._shield_layers and not cls._lockbox_layers:
            raise ValueError("Defense layers have not been registered")
        report: MutableMapping[str, object] = {
            "checked_at": _timestamp(),
            "shield": {},
            "lockbox": {},
            "passed": True,
        }
        for name, payload in cls._shield_layers.items():
            cls._validate_shield_payload(name, payload)
            report["shield"][name] = {
                "status": payload["status"],
                "mode": payload["mode"],
                "engaged_at": payload["engaged_at"],
                "whitelist": tuple(payload.get("whitelist", ())),
            }
        for name, payload in cls._lockbox_layers.items():
            cls._validate_lockbox_payload(name, payload)
            entry = {
                "status": payload["status"],
                "sealed_at": payload["sealed_at"],
                "fingerprint": payload["fingerprint"],
            }
            if "keys" in payload:
                entry["keys"] = tuple(payload["keys"])
            report["lockbox"][name] = entry
        report["summary"] = {
            "shield_layers": len(cls._shield_layers),
            "lockboxes": len(cls._lockbox_layers),
        }
        return dict(report)

    @classmethod
    def _record_history(cls, layer_type: str, modules: Iterable[str]) -> None:
        history = list(cls._history)
        history.append({
            "type": str(layer_type),
            "recorded_at": _timestamp(),
            "modules": tuple(modules),
        })
        cls._history = tuple(history)

    @staticmethod
    def _normalize(
        modules: Mapping[str, object],
        coercer: Callable[[str, object], Mapping[str, object]],
    ) -> Dict[str, Mapping[str, object]]:
        normalized: Dict[str, Mapping[str, object]] = {}
        for name, module in modules.items():
            normalized[name] = coercer(name, module)
        return normalized

    @staticmethod
    def _coerce_payload(module: object) -> MutableMapping[str, object]:
        if hasattr(module, "to_payload") and callable(module.to_payload):  # type: ignore[attr-defined]
            payload = module.to_payload()  # type: ignore[assignment]
        elif isinstance(module, Mapping):
            payload = dict(module)
        else:
            raise TypeError(f"Unsupported defense module type: {type(module)!r}")
        return payload  # type: ignore[return-value]

    @classmethod
    def _coerce_shield_module(
        cls, name: str, module: object
    ) -> Mapping[str, object]:
        payload = dict(cls._coerce_payload(module))
        required = ("module", "status", "mode", "engaged_at")
        for field in required:
            if field not in payload:
                raise ValueError(f"Shield module '{name}' missing field '{field}'")
        if "config" not in payload or not isinstance(payload["config"], Mapping):
            payload["config"] = {}
        else:
            payload["config"] = dict(payload["config"])
        if "whitelist" in payload:
            whitelist = payload["whitelist"]
            if isinstance(whitelist, Iterable) and not isinstance(whitelist, (str, bytes)):
                payload["whitelist"] = tuple(whitelist)
            else:
                payload["whitelist"] = (str(whitelist),)
        return payload

    @classmethod
    def _coerce_lockbox_module(
        cls, name: str, module: object
    ) -> Mapping[str, object]:
        payload = dict(cls._coerce_payload(module))
        required = ("module", "status", "sealed_at", "fingerprint")
        for field in required:
            if field not in payload:
                raise ValueError(f"Lockbox module '{name}' missing field '{field}'")
        if "payload" not in payload or not isinstance(payload["payload"], Mapping):
            payload["payload"] = {}
        else:
            payload["payload"] = dict(payload["payload"])
        if "keys" in payload:
            keys = payload["keys"]
            if isinstance(keys, Iterable) and not isinstance(keys, (str, bytes)):
                payload["keys"] = tuple(keys)
            else:
                payload["keys"] = (str(keys),)
        return payload

    @staticmethod
    def _clone_shield_payload(payload: Mapping[str, object]) -> Mapping[str, object]:
        cloned: MutableMapping[str, object] = {
            "module": payload["module"],
            "status": payload["status"],
            "mode": payload["mode"],
            "engaged_at": payload["engaged_at"],
            "config": dict(payload.get("config", {})),
        }
        if "whitelist" in payload and payload["whitelist"]:
            cloned["whitelist"] = tuple(payload["whitelist"])
        return cloned

    @staticmethod
    def _clone_lockbox_payload(payload: Mapping[str, object]) -> Mapping[str, object]:
        cloned: MutableMapping[str, object] = {
            "module": payload["module"],
            "status": payload["status"],
            "sealed_at": payload["sealed_at"],
            "payload": dict(payload.get("payload", {})),
            "fingerprint": payload["fingerprint"],
        }
        if "keys" in payload:
            cloned["keys"] = tuple(payload["keys"])
        return cloned

    @staticmethod
    def _validate_shield_payload(name: str, payload: Mapping[str, object]) -> None:
        engaged_at = str(payload["engaged_at"])
        if "T" not in engaged_at:
            raise ValueError(
                f"Shield module '{name}' engagement timestamp must be ISO formatted"
            )

    @staticmethod
    def _validate_lockbox_payload(name: str, payload: Mapping[str, object]) -> None:
        sealed_at = str(payload["sealed_at"])
        if "T" not in sealed_at:
            raise ValueError(
                f"Lockbox module '{name}' seal timestamp must be ISO formatted"
            )


class PurposeSuite:
    """Purpose centric validation across mission alignment primitives."""

    _history: Sequence[Mapping[str, object]] = ()

    @classmethod
    def clear(cls) -> None:
        cls._history = ()
        EchoPath.clear_registry()
        MissionMonitor.clear_registry()
        VectorSync.clear_registry()

    @classmethod
    def history(cls) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in cls._history)

    @classmethod
    def _ensure_ready(
        cls,
    ) -> tuple[Sequence[EchoPath], Sequence[MissionMonitor], Sequence[VectorSync]]:
        loops = EchoPath.registry()
        if not loops:
            raise ValueError("No EchoPath loops have been initiated")
        monitors = MissionMonitor.registry()
        if not monitors:
            raise ValueError("No MissionMonitor instances are tracking values")
        vectors = VectorSync.registry()
        if not vectors:
            raise ValueError("No VectorSync alignments are active")
        return loops, monitors, vectors

    @classmethod
    def run_all(cls) -> Mapping[str, object]:
        loops, monitors, vectors = cls._ensure_ready()
        echo_payload = [loop.snapshot() for loop in loops]
        monitor_payload = [monitor.snapshot() for monitor in monitors]
        vector_payload = [vector.snapshot() for vector in vectors]
        passed = (
            all(loop["active"] for loop in echo_payload)
            and all(
                monitor["status"] in {"ok", "pending"} for monitor in monitor_payload
            )
            and all(vector["active"] for vector in vector_payload)
        )
        summary = {
            "echo_paths": len(echo_payload),
            "mission_monitors": len(monitor_payload),
            "vector_syncs": len(vector_payload),
            "loyalty_events": sum(loop["loyalty_events"] for loop in echo_payload),
        }
        report: MutableMapping[str, object] = {
            "checked_at": _timestamp(),
            "echo_paths": echo_payload,
            "mission_monitors": monitor_payload,
            "vector_syncs": vector_payload,
            "summary": summary,
            "passed": passed,
            "status": "ok" if passed else "attention",
        }
        history = list(cls._history)
        history.append(
            {
                "recorded_at": report["checked_at"],
                "status": report["status"],
                **summary,
            }
        )
        cls._history = tuple(history)
        return dict(report)
