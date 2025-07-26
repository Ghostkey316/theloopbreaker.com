import json
import unittest
from pathlib import Path

from engine.loyalty_engine_v1 import loyalty_report

REWARD_PATH = Path('retroactive_rewards.json')
STREAK_PATH = Path('logs/loyalty_streaks.json')

class LoyaltyEngineBackpayTest(unittest.TestCase):
    def setUp(self):
        if REWARD_PATH.exists():
            REWARD_PATH.unlink()
        if STREAK_PATH.exists():
            STREAK_PATH.unlink()
        REWARD_PATH.write_text(json.dumps({'alice': {'multiplier': 1.5}}))
        STREAK_PATH.parent.mkdir(parents=True, exist_ok=True)
        STREAK_PATH.write_text(json.dumps({'alice': {'last': '2024-02-01', 'count': 3}}))

    def test_report_includes_retroactive_multiplier(self):
        report = loyalty_report('alice')
        self.assertAlmostEqual(report['retro_multiplier'], 1.5)
        self.assertEqual(report['drop_score'], 4.5)

if __name__ == '__main__':
    unittest.main()

