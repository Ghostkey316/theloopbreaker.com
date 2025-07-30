import json
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch

from engine import yield_engine_v1 as ye

class YieldEngineV1Test(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.tmp.name)
        ye.AUDIT_LOG_PATH = self.tmp_path / "audit.json"
        ye.CONFIG_PATH = self.tmp_path / "config.json"
        ye.TRIGGER_PATH = self.tmp_path / "triggers.json"
        ye.VALUES_PATH = self.tmp_path / "values.json"
        ye.OG_LIST_PATH = self.tmp_path / "og.json"
        ye.CONFIG_PATH.write_text(json.dumps({"ethics_anchor": True}))
        ye.TRIGGER_PATH.write_text(json.dumps(["A", "B"]))
        ye.VALUES_PATH.write_text(json.dumps({"loyalty_multipliers": {"default": 1.0}}))
        ye.OG_LIST_PATH.write_text(json.dumps([]))

        def _mock_load_json(path, default=None):
            if Path(path).exists():
                with open(path) as f:
                    return json.load(f)
            return default

        self.patcher = patch.object(ye, "_load_json", side_effect=_mock_load_json)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.tmp.cleanup()

    def test_log_audit_writes_timestamped_entry(self):
        ye._log_audit({"action": "test"})
        log = json.loads(ye.AUDIT_LOG_PATH.read_text())
        self.assertEqual(log[0]["action"], "test")
        self.assertIn("timestamp", log[0])

    def test_distribute_rewards_calculates_amount_and_logs(self):
        with patch.object(ye, "_load_multiplier", return_value=2.0), \
             patch.object(ye, "_wallet_verified", return_value=True), \
             patch.object(ye, "_dynamic_apr", return_value=0.05), \
             patch.object(ye, "get_mission", return_value="m1"):
            data = {"u1": {"wallet": "w1.eth", "behavior": ["A", "C"]}}
            ledger = ye.distribute_rewards(data)
        expected = 1 * 2.0 * 1.15 * 0.05
        self.assertAlmostEqual(ledger["rewards"]["w1.eth"]["amount"], expected)
        log = json.loads(ye.AUDIT_LOG_PATH.read_text())
        self.assertEqual(log[0]["action"], "reward")
        self.assertEqual(log[0]["user_id"], "u1")

    def test_distribute_rewards_respects_ethics_anchor(self):
        ye.CONFIG_PATH.write_text(json.dumps({"ethics_anchor": False}))
        result = ye.distribute_rewards({"u1": {"wallet": "w1.eth"}})
        self.assertEqual(result, {})
        log = json.loads(ye.AUDIT_LOG_PATH.read_text())
        self.assertEqual(log[0]["approved"], False)

