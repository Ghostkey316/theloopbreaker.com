import json
import unittest
import tempfile
from pathlib import Path

import security_monitor as sm

class SecurityMonitorTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        sm.BASE_DIR = self.dir
        sm.BASELINE_PATH = self.dir / 'baseline.json'
        sm.BACKUP_DIR = self.dir / 'backups'
        sm.LOG_PATH = self.dir / 'audit.json'
        self.f1 = self.dir / 'a.txt'
        self.f2 = self.dir / 'b.txt'
        self.f1.write_text('one')
        self.f2.write_text('two')

    def tearDown(self):
        self.tmp.cleanup()

    def test_baseline_and_integrity_reporting(self):
        sm.set_baseline([self.f1, self.f2])
        baseline = json.loads(sm.BASELINE_PATH.read_text())
        self.assertEqual(set(baseline.keys()), {'a.txt', 'b.txt'})
        self.f1.write_text('changed')
        incidents = sm.check_integrity()
        self.assertEqual(len(incidents), 1)
        self.assertEqual(incidents[0]['file'], 'a.txt')
        log = json.loads(sm.LOG_PATH.read_text())
        self.assertEqual(log[0]['file'], 'a.txt')

    def test_integrity_repair_restores_file(self):
        sm.set_baseline([self.f1])
        self.f1.write_text('bad')
        sm.check_integrity(repair=True)
        self.assertEqual(self.f1.read_text(), 'one')

