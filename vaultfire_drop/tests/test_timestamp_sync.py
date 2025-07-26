import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from vaultfire_drop.secure_upload.belief_trigger import send_to_webhook


class TimestampSyncTest(unittest.TestCase):
    def test_send_to_webhook_sync(self):
        with patch('urllib.request.urlopen') as mock_url:
            now = datetime.utcnow().isoformat()
            send_to_webhook('http://localhost', 'w', 'Spark', 10, now, 't', now)
            self.assertEqual(mock_url.call_count, 1)

    def test_send_to_webhook_drift(self):
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
