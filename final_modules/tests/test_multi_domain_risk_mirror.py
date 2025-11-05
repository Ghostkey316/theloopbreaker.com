import json
import tempfile
import unittest
from pathlib import Path
import importlib.util

import pytest

try:  # pragma: no cover - optional dependency gating encryption helpers
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - skip module when dependency missing
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - executed only when dependency present
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for risk mirror tests",
)

MODULE_PATH = Path(__file__).resolve().parents[1] / "multi_domain_risk_mirror.py"
spec = importlib.util.spec_from_file_location("multi_domain_risk_mirror", MODULE_PATH)
md = importlib.util.module_from_spec(spec)
assert spec.loader is not None
if CRYPTOGRAPHY_AVAILABLE:
    spec.loader.exec_module(md)
else:  # pragma: no cover - placeholder when dependency missing
    md = None  # type: ignore[assignment]


class RiskMirrorTest(unittest.TestCase):
    def test_sanitize_terms(self):
        text = "Threat mirror engine detects Rogue signals"
        sanitized = md.sanitize_terms(text)
        self.assertNotIn("Threat mirror engine", sanitized)
        self.assertIn("Resilience simulation core", sanitized)

    def test_model_misuse_logs(self):
        with tempfile.TemporaryDirectory() as tmp:
            md.LOG_PATH = Path(tmp) / "log.json"
            md.model_misuse("digital", "Antivirus suggestions needed", None)
            log = json.loads(md.LOG_PATH.read_text())
            self.assertEqual(log[0]["domain"], "digital")


if __name__ == "__main__":
    unittest.main()
