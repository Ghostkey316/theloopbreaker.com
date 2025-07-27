import unittest
from pathlib import Path
import importlib.util

MODULE_PATH = Path(__file__).resolve().parents[1] / "behavior_drift_defense.py"
spec = importlib.util.spec_from_file_location("behavior_drift_defense", MODULE_PATH)
bd = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(bd)


class BehaviorDriftDefenseTest(unittest.TestCase):
    def test_simulate_drift(self):
        result = bd.simulate_behavior_drift(0.9)
        self.assertIn("drift_detected", result)

    def test_shield_returns_analysis(self):
        result = bd.ghostkey_shield("ghostkey316", 0.5)
        self.assertTrue("analysis" in result or "status" in result)


if __name__ == "__main__":
    unittest.main()
