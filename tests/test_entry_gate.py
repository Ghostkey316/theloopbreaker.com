import json
import os
import subprocess
import unittest
from pathlib import Path

class EntryGateTest(unittest.TestCase):
    def test_login_records_entry(self):
        log_path = Path('entry_log.json')
        if log_path.exists():
            log_path.unlink()
        output = subprocess.check_output(['node', 'vault_entry.js', 'tester', 'dev'])
        data = json.loads(output)
        self.assertEqual(data['session_role'], 'dev')
        log = json.loads(log_path.read_text())
        self.assertEqual(log[-1]['user'], 'tester')

if __name__ == '__main__':
    unittest.main()
