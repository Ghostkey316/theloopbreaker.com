from __future__ import annotations

from vaultfire.modules.vaultfire_protocol_stack import PredictiveYieldFabric


def test_predictive_yield_fabric_forecast_and_optimize() -> None:
    fabric = PredictiveYieldFabric()
    fabric.register_export("core", 0.7)
    fabric.register_export("ally", 0.3)

    captured: list[dict[str, float]] = []

    def _hook(distribution):
        captured.append(dict(distribution))

    fabric.register_hook("capture", _hook)
    forecast = fabric.forecast(signal_purity=0.82, base_yield=200.0)

    assert forecast["identity"]["ens"] == "ghostkey316.eth"
    assert "distribution" in forecast
    assert captured

    optimisation = fabric.auto_optimize()
    weights = optimisation["normalized_weights"]
    assert abs(sum(weights.values()) - 1.0) < 1e-12
