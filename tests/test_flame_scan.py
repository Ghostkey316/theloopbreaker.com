import json
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest

try:  # pragma: no cover - optional dependency for encryption workflows
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - skip module when unavailable
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - executed only when dependency present
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for flame scan tests",
)

if CRYPTOGRAPHY_AVAILABLE:
    from belief_trigger_engine import evaluate_wallet, CHAIN_LOG_PATH, LOG_PATH
else:  # pragma: no cover - placeholders when dependency missing
    evaluate_wallet = None  # type: ignore[assignment]
    CHAIN_LOG_PATH = LOG_PATH = Path("/tmp")  # type: ignore[assignment]


class WebhookOrderTest(unittest.TestCase):
    def setUp(self):
        for p in (CHAIN_LOG_PATH, LOG_PATH):
            if p.exists():
                p.unlink()

    def test_webhook_field_order(self):
        with patch("urllib.request.urlopen") as mock_url:
            result = evaluate_wallet(
                "spark_wallet", chain_log=True, webhook="http://localhost"
            )
            payload = json.loads(mock_url.call_args[0][0].data.decode("utf-8"))
            self.assertEqual(
                list(payload.keys()),
                ["wallet", "tier", "score", "timestamp", "trigger"],
            )
            chain_data = json.loads(CHAIN_LOG_PATH.read_text())[0]
            t1 = datetime.fromisoformat(payload["timestamp"])
            t2 = datetime.fromisoformat(chain_data["timestamp"])
            self.assertLessEqual(abs((t1 - t2).total_seconds()), 0.5)
            self.assertEqual(payload["trigger"], result["trigger"])


if __name__ == "__main__":
    unittest.main()
