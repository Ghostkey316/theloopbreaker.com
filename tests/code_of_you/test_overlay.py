import json
import subprocess
import unittest
from pathlib import Path

MEM = Path('memory_log.json')
COMPASS = Path('signal_compass.json')

class OverlayTest(unittest.TestCase):
    def setUp(self):
        MEM.write_text(json.dumps([
            {"ghost_id": "g1", "session_id": "s1", "action": "say", "details": {"text": "trust"}, "timestamp": 0}
        ]))
        COMPASS.write_text('[]')

    def test_compass_generation(self):
        subprocess.check_call(['node', 'signal_compass.js'])
        self.assertTrue(COMPASS.exists())
        data = json.loads(COMPASS.read_text())
        self.assertEqual(data[0]['ghost_id'], 'g1')

    def test_html_presence(self):
        html = Path('code_of_you.html').read_text()
        self.assertIn('<html', html.lower())

if __name__ == '__main__':
    unittest.main()
