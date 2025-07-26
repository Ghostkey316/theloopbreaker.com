import json
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from belief_trigger_engine import evaluate_wallet, CHAIN_LOG_PATH, LOG_PATH


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
