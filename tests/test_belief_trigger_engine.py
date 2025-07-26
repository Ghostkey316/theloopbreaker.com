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
        triggers = {d['wallet']: d['trigger'] for d in data}
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
            result = evaluate_wallet(
                'spark_wallet',
                chain_log=True,
                webhook='http://localhost/web'
            )
            self.assertEqual(mock_url.call_count, 1)
            request_obj = mock_url.call_args[0][0]
            payload = json.loads(request_obj.data.decode('utf-8'))
            self.assertEqual(list(payload.keys()), ['wallet', 'tier', 'score', 'timestamp'])
            self.assertEqual(payload['wallet'], 'spark_wallet')
            self.assertEqual(payload['tier'], 'Spark')
            self.assertEqual(payload['score'], 10)
        self.assertTrue(CHAIN_LOG_PATH.exists())
        chain_data = json.loads(CHAIN_LOG_PATH.read_text())
        expected = {
            'wallet': 'spark_wallet',
            'tier': 'Spark',
            'score': 10,
        }
        for key, value in expected.items():
            self.assertEqual(chain_data[0][key], value)
        self.assertIn('timestamp', chain_data[0])
        self.assertEqual(payload['timestamp'], chain_data[0]['timestamp'])
        self.assertEqual(list(chain_data[0].keys()), ['wallet', 'tier', 'score', 'timestamp'])
        self.assertEqual(
            list(result.keys()),
            ['wallet', 'tier', 'score', 'timestamp', 'trigger']
        )

    def test_no_chain_no_webhook(self):
        with patch('urllib.request.urlopen') as mock_url:
            evaluate_wallet('spark_wallet')
            self.assertEqual(mock_url.call_count, 0)
        self.assertFalse(CHAIN_LOG_PATH.exists())

    def test_activate_reward_chain_log(self):
        from belief_trigger_engine import activate_belief_reward

        activate_belief_reward('flame_wallet', 65, chain_log=True)
        chain_data = json.loads(CHAIN_LOG_PATH.read_text())
        entry = chain_data[0]
        self.assertEqual(entry['wallet'], 'flame_wallet')
        self.assertEqual(entry['tier'], 'loyalty')
        self.assertEqual(entry['score'], 65)
        self.assertIn('timestamp', entry)
        self.assertEqual(list(entry.keys()), ['wallet', 'tier', 'score', 'timestamp'])

    def test_activate_reward_no_chain_without_flag(self):
        from belief_trigger_engine import activate_belief_reward

        activate_belief_reward('flame_wallet', 65, chain_log=False)
        self.assertFalse(CHAIN_LOG_PATH.exists())


if __name__ == '__main__':
    unittest.main()
