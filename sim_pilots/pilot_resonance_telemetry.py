from __future__ import annotations

from . import _load

__all__ = ["PilotResonanceTelemetry"]

_module = _load()
PilotResonanceTelemetry = _module.PilotResonanceTelemetry
