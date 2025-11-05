from __future__ import annotations

import importlib.util
from pathlib import Path


def _load_module(path: str, name: str):
    spec = importlib.util.spec_from_file_location(name, Path(path))
    module = importlib.util.module_from_spec(spec)
    assert spec is not None and spec.loader is not None
    import sys
    sys.modules[name] = module
    spec.loader.exec_module(module)  # type: ignore[assignment]
    return module


alignment_beacon = _load_module("alignment_beacon.py", "alignment_beacon")
drift_oracle_mod = _load_module("drift_oracle.py", "drift_oracle")

AlignmentSimulator = alignment_beacon.AlignmentSimulator
simulate_alignment_beacon = alignment_beacon.simulate_alignment_beacon
DriftOracle = drift_oracle_mod.DriftOracle


def test_alignment_simulator_respects_drift_limit() -> None:
    oracle = DriftOracle([0.96, 0.97, 0.98], drift_limit=0.05, trials=128)
    simulator = AlignmentSimulator(drift_limit=0.05)
    summary = simulator.simulate(drift_oracle=oracle)
    assert summary["drift"] < 0.05
    assert summary["alignment"] > 0.5


def test_alignment_beacon_simulation_emits_attestation() -> None:
    summary = simulate_alignment_beacon()
    assert "attestation" in summary
    assert "Drift <3%" in summary["attestation"]
