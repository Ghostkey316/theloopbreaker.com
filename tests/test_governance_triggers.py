import json
import os
import tempfile
from pathlib import Path

from governance.automation_triggers import evaluate_triggers


def test_governance_triggers_detect_backlog(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        queue_path = Path(tmp) / 'queue.json'
        queue_path.write_text(json.dumps([
            {
                'next_attempt': 0,
                'dead_letter': False,
            },
            {
                'next_attempt': 0,
                'dead_letter': True,
            }
        ]), encoding='utf-8')

        alerts_path = Path(tmp) / 'alerts.json'
        alerts_path.write_text(json.dumps([{'id': 1}]), encoding='utf-8')

        ethics_path = Path(tmp) / 'ethics.json'
        ethics_path.write_text(json.dumps([{'id': 'override'}]), encoding='utf-8')

        triggers = evaluate_triggers(
            queue_path=queue_path,
            security_alerts_path=alerts_path,
            ethics_path=ethics_path,
            backlog_threshold=1.0,
        )

        keys = {trigger.key for trigger in triggers}
        assert 'delivery.backlog' in keys
        assert 'delivery.dead_letter' in keys
        assert 'security.alerts' in keys
        assert 'ethics.override' in keys
