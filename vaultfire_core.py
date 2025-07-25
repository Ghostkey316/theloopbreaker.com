"""Vaultfire Core utilities."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from engine.proof_of_loyalty import record_belief_action

PURPOSE_MAP_PATH = Path('purpose_map.json')


def sync_purpose(domain: str, trait: str, role: str) -> dict:
    record = {
        'domain': domain,
        'trait': trait,
        'role': role,
        'timestamp': datetime.utcnow().isoformat()
    }
    try:
        data = json.loads(PURPOSE_MAP_PATH.read_text())
    except Exception:
        data = {'records': []}
    data.setdefault('records', []).append(record)
    PURPOSE_MAP_PATH.write_text(json.dumps(data, indent=2))
    return record


def cli_belief(identity: str, wallet: str, text: str) -> dict:
    result = record_belief_action(identity, wallet, text)
    sync_purpose('cli', 'belief', 'record')
    return result


def protocol_notify(event: str, payload: dict) -> None:
    """Proxy event notifications to the Ghostkey trader channel."""
    try:
        from ghostkey_trader_notifications import notify_event
    except Exception:
        return
    try:
        notify_event(event, payload)
    except Exception:
        pass
