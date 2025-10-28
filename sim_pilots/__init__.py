from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType
from typing import Any

__all__ = ["PilotResonanceTelemetry"]

_module_cache: ModuleType | None = None


def _load() -> ModuleType:
    global _module_cache
    if _module_cache is None:
        module_path = Path(__file__).resolve().parent.parent / "sim-pilots" / "pilot_resonance_telemetry.py"
        spec = importlib.util.spec_from_file_location("sim_pilots.pilot_resonance_telemetry", module_path)
        if spec is None or spec.loader is None:  # pragma: no cover - importlib fallback
            raise ImportError("Unable to load pilot_resonance_telemetry")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _module_cache = module
    return _module_cache


def __getattr__(name: str) -> Any:
    module = _load()
    if hasattr(module, name):
        return getattr(module, name)
    raise AttributeError(name)


def __dir__() -> list[str]:
    module = _load()
    return sorted(set(__all__ + dir(module)))


PilotResonanceTelemetry = _load().PilotResonanceTelemetry
