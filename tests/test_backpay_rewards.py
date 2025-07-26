import json
import unittest
from pathlib import Path

from engine.retroactive_rewards import calculate_retro_rewards, write_retro_rewards

SNAP_DIR = Path('memory_snapshots')
REWARD_PATH = Path('retroactive_rewards.json')

class BackpayRewardsTest(unittest.TestCase):
    def setUp(self):
        if SNAP_DIR.exists():
            for f in SNAP_DIR.iterdir():
                f.unlink()
        else:
            SNAP_DIR.mkdir()
        if REWARD_PATH.exists():
            REWARD_PATH.unlink()
        # create two snapshots
        old = {
            'w1': {'score': 100},
            'w2': {'score': 100},
            'w3': {'score': 100},
        }
        new = {
            'w1': {'score': 160},
            'w2': {'score': 120},
            'w3': {'score': 80},
        }
        (SNAP_DIR / 'wallet_memory_2024-01-01.json').write_text(json.dumps(old))
        (SNAP_DIR / 'wallet_memory_2024-02-01.json').write_text(json.dumps(new))

    def test_growth_scoring(self):
        rewards = calculate_retro_rewards()
        write_retro_rewards(rewards)
        data = json.loads(REWARD_PATH.read_text())
        self.assertIn('w1', data)
        self.assertEqual(data['w1']['tier'], 'Tier 3')
        self.assertIn('w2', data)
        self.assertEqual(data['w2']['tier'], 'Tier 1')
        self.assertNotIn('w3', data)

if __name__ == '__main__':
    unittest.main()

