import json
import tempfile
import unittest
from pathlib import Path

import importlib.util

MODULE_PATH = Path(__file__).resolve().parents[1] / "grid_gpu_monitor.py"
spec = importlib.util.spec_from_file_location("grid_gpu_monitor", MODULE_PATH)
gm = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(gm)


class GridGpuMonitorTest(unittest.TestCase):
    def test_log_and_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            gm.LOG_PATH = Path(tmp) / "log.json"
            gm.log_system_snapshot(1.0, 0.9, 65.0, "zoneA")
            gm.log_system_snapshot(1.5, 0.7, 70.0, "zoneA")
            summary = gm.summarize_state()
            self.assertIn("avg_grid_gw", summary)
            self.assertEqual(summary["heat_zones"]["zoneA"]["count"], 2)


if __name__ == "__main__":
    unittest.main()
