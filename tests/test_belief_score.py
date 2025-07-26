import json
import unittest
from pathlib import Path

from engine.belief_multiplier import record_belief_action, belief_multiplier

BELIEF_PATH = Path('belief_score.json')


class BeliefScoreTest(unittest.TestCase):
    def setUp(self):
        if BELIEF_PATH.exists():
            BELIEF_PATH.unlink()

    def test_scoring_and_tier(self):
        for _ in range(10):
            record_belief_action('alice', 'interaction')
        record_belief_action('alice', 'flame')
        data = json.loads(BELIEF_PATH.read_text())
        self.assertEqual(data['alice']['interactions'], 10)
        self.assertEqual(data['alice']['flames'], 1)
        mult, tier = belief_multiplier('alice')
        self.assertEqual(tier, 'Glow')
        self.assertAlmostEqual(mult, 1.05)


if __name__ == '__main__':
    unittest.main()
