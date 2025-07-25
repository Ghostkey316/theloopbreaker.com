import json
import subprocess
import unittest
from pathlib import Path

MEM_LOG = Path('memory_log.json')
REWARD_LOG = Path('rewards_log.json')
TX_LOG = Path('simulated_tx.json')

class RewardLoopTest(unittest.TestCase):
    def setUp(self):
        for p in (MEM_LOG, REWARD_LOG, TX_LOG):
            if p.exists():
                p.unlink()
        MEM_LOG.write_text(json.dumps([
            {"ghost_id":"g1","session_id":"s1","action":"belief_milestone","details":{},"timestamp":0}
        ]))
        REWARD_LOG.write_text('[]')
        TX_LOG.write_text('[]')

    def test_reward_emitted(self):
        subprocess.check_call(['python', 'reward_loop.py', 'bpow20.cb.id'])
        rewards = json.loads(REWARD_LOG.read_text())
        self.assertTrue(rewards and rewards[-1]['ghost_id']=='g1')
        tx = json.loads(TX_LOG.read_text())
        self.assertEqual(tx[-1]['wallet'], 'bpow20.cb.id')

if __name__ == '__main__':
    unittest.main()
