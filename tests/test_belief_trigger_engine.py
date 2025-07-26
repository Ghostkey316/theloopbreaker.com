import json
import unittest
from pathlib import Path
from unittest.mock import patch

from belief_trigger_engine import (
    evaluate_wallet,
    LOG_PATH,
    CHAIN_LOG_PATH,
)

BELIEF_PATH = Path('belief_score.json')


class BeliefTriggerEngineTest(unittest.TestCase):
    def setUp(self):
        for p in (BELIEF_PATH, LOG_PATH, CHAIN_LOG_PATH):
            if p.exists():
                p.unlink()
        BELIEF_PATH.write_text(json.dumps({
            'spark_wallet': {'interactions': 10},
            'torch_wallet': {'interactions': 30},
            'flame_wallet': {'interactions': 60},
            'inferno_wallet': {'interactions': 90},
            'below_wallet': {'interactions': 9}
        }))

    def test_threshold_triggers(self):
        evaluate_wallet('spark_wallet')
        evaluate_wallet('torch_wallet')
        evaluate_wallet('flame_wallet')
        evaluate_wallet('inferno_wallet')
        data = json.loads(LOG_PATH.read_text())
        triggers = {d['wallet_id']: d['trigger'] for d in data}
        self.assertEqual(triggers['spark_wallet'], 'bonus_drop')
        self.assertEqual(triggers['torch_wallet'], 'unlock_nft_trait')
        self.assertEqual(triggers['flame_wallet'], 'claim_reward')
        self.assertEqual(triggers['inferno_wallet'], 'claim_reward')

    def test_no_trigger_below_threshold(self):
        result = evaluate_wallet('below_wallet')
        self.assertIsNone(result['tier'])
        self.assertFalse(LOG_PATH.exists())

    def test_chain_and_webhook_logging(self):
        with patch('urllib.request.urlopen') as mock_url:
            evaluate_wallet(
                'spark_wallet',
                chain_log=True,
                webhook='http://localhost/web'
            )
            self.assertEqual(mock_url.call_count, 1)
        self.assertTrue(CHAIN_LOG_PATH.exists())
        chain_data = json.loads(CHAIN_LOG_PATH.read_text())
        self.assertEqual(chain_data[0]['wallet'], 'spark_wallet')
        self.assertEqual(chain_data[0]['tier'], 'Spark')


if __name__ == '__main__':
    unittest.main()
