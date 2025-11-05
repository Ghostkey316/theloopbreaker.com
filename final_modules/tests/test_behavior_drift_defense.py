import unittest
from pathlib import Path
import importlib.util

import pytest

try:  # pragma: no cover - optional dependency in minimal Vaultfire installs
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - skip tests when crypto unavailable
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - executed only when dependency present
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for behavior drift defense tests",
)

MODULE_PATH = Path(__file__).resolve().parents[1] / "behavior_drift_defense.py"
spec = importlib.util.spec_from_file_location("behavior_drift_defense", MODULE_PATH)
bd = importlib.util.module_from_spec(spec)
assert spec.loader is not None
if CRYPTOGRAPHY_AVAILABLE:
    spec.loader.exec_module(bd)
else:  # pragma: no cover - placeholder when dependency missing
    bd = None  # type: ignore[assignment]


class BehaviorDriftDefenseTest(unittest.TestCase):
    def test_simulate_drift(self):
        result = bd.simulate_behavior_drift(0.9)
        self.assertIn("drift_detected", result)

    def test_shield_returns_analysis(self):
        result = bd.ghostkey_shield("ghostkey316", 0.5)
        self.assertTrue("analysis" in result or "status" in result)


if __name__ == "__main__":
    unittest.main()
