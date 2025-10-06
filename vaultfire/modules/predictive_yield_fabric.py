"""Predictive Yield Fabric for aligned outcome forecasting."""

from __future__ import annotations

from typing import Callable, Mapping, MutableMapping

from ._metadata import build_metadata

IDENTITY_HANDLE = "bpow20.cb.id"
IDENTITY_ENS = "ghostkey316.eth"


class PredictiveYieldFabric:
    """Weighted forecasting and auto-optimisation helper."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self._exports: MutableMapping[str, float] = {}
        self._hooks: MutableMapping[str, Callable[[Mapping[str, float]], None]] = {}
        self._latest_forecast: Mapping[str, object] | None = None
        self.metadata: Mapping[str, object] = build_metadata(
            "PredictiveYieldFabric",
            identity={
                "wallet": identity_handle,
                "ens": identity_ens,
            },
        )

    def register_export(self, name: str, weight: float) -> None:
        weight = max(float(weight), 0.0)
        self._exports[name] = weight

    def bulk_register(self, exports: Mapping[str, float] | None) -> None:
        if not exports:
            return
        for name, weight in exports.items():
            self.register_export(str(name), float(weight))

    def register_hook(self, name: str, callback: Callable[[Mapping[str, float]], None]) -> None:
        self._hooks[name] = callback

    def forecast(
        self,
        signal_purity: float,
        base_yield: float,
        *,
        horizon: int = 3,
    ) -> Mapping[str, object]:
        """Compute a weighted yield forecast and notify registered hooks."""

        if not self._exports:
            self.register_export("core", 1.0)
        normalized_total = sum(self._exports.values()) or 1.0
        composite = float(base_yield) * (0.5 + max(float(signal_purity), 0.0) * 0.5)
        distribution = {
            name: composite * (weight / normalized_total)
            for name, weight in self._exports.items()
        }
        for callback in self._hooks.values():
            callback(distribution)
        self._latest_forecast = {
            "identity": self.metadata["identity"],
            "horizon": horizon,
            "composite_yield": composite,
            "distribution": distribution,
        }
        return self._latest_forecast

    def auto_optimize(self) -> Mapping[str, object]:
        """Return normalised export weights."""

        total = sum(self._exports.values()) or 1.0
        normalised = {name: (weight / total) for name, weight in self._exports.items()}
        return {
            "identity": self.metadata["identity"],
            "normalized_weights": normalised,
            "metadata": self.metadata,
        }

    @property
    def latest_forecast(self) -> Mapping[str, object] | None:
        return self._latest_forecast


__all__ = ["PredictiveYieldFabric"]

