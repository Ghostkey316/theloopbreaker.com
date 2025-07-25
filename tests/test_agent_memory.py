import json
import os
import subprocess
import unittest
from pathlib import Path

MEM_LOG = Path('memory_log.json')

class AgentMemoryTest(unittest.TestCase):
    def setUp(self):
        if MEM_LOG.exists():
            MEM_LOG.unlink()
        MEM_LOG.write_text('[]')

    def test_log_and_score(self):
        script = "const m=require('./agent_memory');\n" \
                 "m.logAction('g1','s1','belief_milestone',{text:'truth loyalty'});\n" \
                 "console.log(m.alignmentScore('g1').toFixed(2));"
        out = subprocess.check_output(['node', '-e', script])
        score = float(out.decode().strip())
        self.assertGreaterEqual(score, 0)
        log = json.loads(MEM_LOG.read_text())
        self.assertEqual(log[0]['ghost_id'], 'g1')
        self.assertGreaterEqual(score, 0.3)

if __name__ == '__main__':
    unittest.main()
