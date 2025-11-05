import json
import unittest
from pathlib import Path
from unittest.mock import patch

import pytest

try:  # pragma: no cover - optional dependency powering encryption pipeline
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - skip module when unavailable
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - executed only when dependency present
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for live flame scan tests",
)

if CRYPTOGRAPHY_AVAILABLE:
    from belief_trigger_engine import LOG_PATH, CHAIN_LOG_PATH
    from live_flame_scan import process_scores
else:  # pragma: no cover - placeholders when dependency missing
    LOG_PATH = CHAIN_LOG_PATH = Path("/tmp")  # type: ignore[assignment]
    process_scores = None  # type: ignore[assignment]


class LiveFlameScanTest(unittest.TestCase):
    def setUp(self):
        for p in (LOG_PATH, CHAIN_LOG_PATH, Path('test_flame_log.json')):
            if p.exists():
                p.unlink()

    def test_process_scores_all_tiers(self):
        scores = {
            'high_wallet': 95,
            'mid_wallet': 75,
            'loyal_wallet': 55,
            'boost_wallet': 20,
        }
        with patch('urllib.request.urlopen') as mock_url:
            results = process_scores(
                scores,
                Path('test_flame_log.json'),
                webhook='http://localhost/web',
                chain=True,
            )
            self.assertEqual(mock_url.call_count, 4)
            request_obj = mock_url.call_args_list[0][0][0]
            payload = json.loads(request_obj.data.decode('utf-8'))
            self.assertEqual(
                list(payload.keys()),
                ['wallet', 'tier', 'score', 'timestamp', 'trigger']
            )
            self.assertEqual(
                list(results[0].keys()),
                ['wallet', 'tier', 'score', 'timestamp', 'trigger']
            )
        triggers = {r['wallet']: r['trigger'] for r in results}
        self.assertEqual(triggers['high_wallet'], 'high_tier_reward')
        self.assertEqual(triggers['mid_wallet'], 'mid_tier_reward')
        self.assertEqual(triggers['loyal_wallet'], 'loyalty_ping')
        self.assertEqual(triggers['boost_wallet'], 'belief_boost_suggestion')
        log = json.loads(Path('test_flame_log.json').read_text())
        self.assertEqual(len(log), 4)
        chain_log = json.loads(CHAIN_LOG_PATH.read_text())
        self.assertEqual(len(chain_log), 4)
        self.assertEqual(
            list(chain_log[0].keys()),
            ['wallet', 'tier', 'score', 'timestamp']
        )
        self.assertEqual(payload['timestamp'], chain_log[0]['timestamp'])
        self.assertEqual(payload['timestamp'], results[0]['timestamp'])


if __name__ == '__main__':
    unittest.main()
