"""Governance automation triggers for Vaultfire."""
from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, List

DEFAULT_QUEUE_PATH = Path(os.environ.get('VAULTFIRE_WEBHOOK_QUEUE', 'webhook_delivery_queue.json'))
DEFAULT_SECURITY_ALERTS_PATH = Path('logs/security_alerts.json')
DEFAULT_ETHICS_ESCALATIONS_PATH = Path('logs/ethics_overrides.json')


@dataclass
class Trigger:
    """Represents an automation trigger emitted for governance processing."""

    key: str
    severity: str
    reason: str
    action: str


def _load_json(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return data
    return []


def _load_queue(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    return data


def _queue_backlog_seconds(entries: Iterable[dict]) -> float:
    now = time.time()
    backlog = 0.0
    for entry in entries:
        next_attempt = float(entry.get('next_attempt', 0))
        if entry.get('dead_letter'):
            backlog = max(backlog, now - next_attempt)
        elif next_attempt < now:
            backlog = max(backlog, now - next_attempt)
    return backlog


def evaluate_triggers(
    queue_path: Path = DEFAULT_QUEUE_PATH,
    security_alerts_path: Path = DEFAULT_SECURITY_ALERTS_PATH,
    ethics_path: Path = DEFAULT_ETHICS_ESCALATIONS_PATH,
    *,
    backlog_threshold: float = 60.0,
) -> List[Trigger]:
    """Evaluate governance automation triggers based on local telemetry."""

    triggers: List[Trigger] = []

    queue_entries = _load_queue(queue_path)
    backlog_seconds = _queue_backlog_seconds(queue_entries)
    if queue_entries and backlog_seconds > backlog_threshold:
        triggers.append(
            Trigger(
                key='delivery.backlog',
                severity='alert',
                reason=f'Webhook queue backlog {backlog_seconds:.1f}s exceeds {backlog_threshold}s.',
                action='Schedule governance review and block scaling approvals.',
            )
        )

    dead_letters = [entry for entry in queue_entries if entry.get('dead_letter')]
    if dead_letters:
        triggers.append(
            Trigger(
                key='delivery.dead_letter',
                severity='warning',
                reason=f'{len(dead_letters)} webhook deliveries reached max attempts.',
                action='Open incident and notify partner success team.',
            )
        )

    security_alerts = _load_json(security_alerts_path)
    if security_alerts:
        triggers.append(
            Trigger(
                key='security.alerts',
                severity='critical',
                reason=f'{len(security_alerts)} unresolved security alerts present.',
                action='Escalate to compliance steward referencing SOC 2 CC7.3.',
            )
        )

    ethics_overrides = _load_json(ethics_path)
    if ethics_overrides:
        triggers.append(
            Trigger(
                key='ethics.override',
                severity='review',
                reason=f'{len(ethics_overrides)} ethics overrides awaiting steward response.',
                action='Page ethics steward roster before deployment resumes.',
            )
        )

    return triggers


def main() -> int:
    triggers = evaluate_triggers()
    for trigger in triggers:
        print(json.dumps(asdict(trigger)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
