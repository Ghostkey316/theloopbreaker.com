import json
import unittest
from pathlib import Path

from engine.loyalty_engine_v1 import loyalty_report
from engine.belief_multiplier import belief_multiplier

REWARD_PATH = Path('retroactive_rewards.json')
STREAK_PATH = Path('logs/loyalty_streaks.json')
BELIEF_PATH = Path('belief_score.json')

class LoyaltyEngineBackpayTest(unittest.TestCase):
    def setUp(self):
        if REWARD_PATH.exists():
            REWARD_PATH.unlink()
        if STREAK_PATH.exists():
            STREAK_PATH.unlink()
        if BELIEF_PATH.exists():
            BELIEF_PATH.unlink()
        REWARD_PATH.write_text(json.dumps({'alice': {'multiplier': 1.5}}))
        STREAK_PATH.parent.mkdir(parents=True, exist_ok=True)
        STREAK_PATH.write_text(json.dumps({'alice': {'last': '2024-02-01', 'count': 3}}))
        BELIEF_PATH.write_text(json.dumps({'alice': {'interactions': 10, 'growth_events': 0, 'milestones': 0, 'flames': 1}}))

    def test_report_includes_retroactive_multiplier(self):
        report = loyalty_report('alice')
        self.assertAlmostEqual(report['retro_multiplier'], 1.5)
        self.assertAlmostEqual(report['drop_score'], 4.725)

    def test_belief_stack_sync(self):
        report = loyalty_report('alice')
        self.assertEqual(report['flame_tier'], 'Glow')
        base = 3 * 1.5
        expected = base * 1.05
        self.assertAlmostEqual(report['drop_score'], expected)

if __name__ == '__main__':
    unittest.main()

