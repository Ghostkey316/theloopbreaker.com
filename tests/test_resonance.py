from __future__ import annotations

import math

import importlib.util
from pathlib import Path


def _load_resonance():
    path = Path("vaultfire/pilot_mode/resonance.py")
    spec = importlib.util.spec_from_file_location("resonance_module", path)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None and spec.loader is not None
    import sys
    sys.modules[spec.name] = module  # type: ignore[index]
    spec.loader.exec_module(module)  # type: ignore[assignment]
    return module


resonance = _load_resonance()
ResonanceAnomalyDetector = resonance.ResonanceAnomalyDetector


def test_resonance_detector_simulation_controls_drift() -> None:
    base = [0.95, 0.96, 0.97]
    detector = ResonanceAnomalyDetector(threshold=0.12)
    detector.fit(base, epochs=2, batch_size=3)
    population = detector.simulate_population(base_signals=base, population=1024, noise=0.005)
    score = detector.score(population)
    assert score["drift_ratio"] < 0.12
    assert detector.is_anomalous([0.2 for _ in range(8)])
    assert not detector.is_anomalous(population)


def test_resonance_detector_belief_log_loader(tmp_path) -> None:
    belief_path = tmp_path / "belief.json"
    belief_path.write_text('[{"belief_multiplier": 0.94}, {"belief_multiplier": 0.96}]')
    values = ResonanceAnomalyDetector.load_belief_log(path=belief_path)
    assert math.isclose(sum(values), 1.9, rel_tol=1e-5)
