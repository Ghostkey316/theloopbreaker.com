import os
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from belief_trigger_engine import send_to_webhook


class TimestampSyncTest(unittest.TestCase):
    def test_send_to_webhook_sync(self):
        with tempfile.TemporaryDirectory() as tmp:
            queue_path = os.path.join(tmp, 'queue.json')
            with patch.dict('os.environ', {'VAULTFIRE_WEBHOOK_QUEUE': queue_path}):
                with patch('urllib.request.urlopen') as mock_url:
                    now = datetime.utcnow().isoformat()
                    send_to_webhook('http://localhost', 'w', 'Spark', 10, now, 't', now)
                    self.assertEqual(mock_url.call_count, 1)

    def test_send_to_webhook_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            queue_path = os.path.join(tmp, 'queue.json')
            with patch.dict('os.environ', {'VAULTFIRE_WEBHOOK_QUEUE': queue_path}):
                with patch('urllib.request.urlopen'):
                    ts1 = datetime.utcnow()
                    ts2 = ts1 + timedelta(seconds=1)
                    with self.assertRaises(ValueError):
                        send_to_webhook(
                            'http://localhost',
                            'w',
                            'Spark',
                            10,
                            ts1.isoformat(),
                            't',
                            ts2.isoformat(),
                        )


if __name__ == '__main__':
    unittest.main()
