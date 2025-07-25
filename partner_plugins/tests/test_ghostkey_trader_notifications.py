import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import ghostkey_trader_notifications as gtn

class NotifyTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.settings = Path(self.tmp.name) / "user.json"

    def tearDown(self):
        self.tmp.cleanup()

    def write_settings(self, data):
        self.settings.write_text(json.dumps(data))

    def test_trade_triggers_log(self):
        self.write_settings({"notify_trader_activity": True, "notification_channel": "log_to_terminal"})
        with patch.dict(os.environ, {"VF_USER_SETTINGS_PATH": str(self.settings)}):
            with patch("builtins.print") as mock_print:
                gtn.notify_event("trade_executed", {"symbol": "ASM"})
                self.assertTrue(mock_print.called)

    def test_opt_out_sends_nothing(self):
        self.write_settings({"notify_trader_activity": False})
        with patch.dict(os.environ, {"VF_USER_SETTINGS_PATH": str(self.settings)}):
            with patch("builtins.print") as mock_print:
                gtn.notify_event("trade_executed", {"symbol": "ASM"})
                self.assertFalse(mock_print.called)

    def test_mobile_webhook_payload(self):
        self.write_settings({
            "notify_trader_activity": True,
            "notification_channel": "mobile_webhook",
            "webhook_url": "http://localhost/test",
        })
        with patch.dict(os.environ, {"VF_USER_SETTINGS_PATH": str(self.settings)}):
            with patch("urllib.request.urlopen") as mock_open:
                gtn.notify_event("trade_executed", {"symbol": "ASM"})
                self.assertTrue(mock_open.called)
                req = mock_open.call_args[0][0]
                payload = json.loads(req.data.decode())
                self.assertEqual(req.full_url, "http://localhost/test")
                self.assertEqual(payload["id"], "Ghostkey-316")

if __name__ == "__main__":
    unittest.main()
