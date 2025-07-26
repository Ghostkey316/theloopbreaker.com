import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

EVENT_LOG = Path('event_log.json')
TIER_PATH = Path('loyalty_tiers.json')
BUFFER_PATH = Path('ghost_loop_buffer.json')


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)


def monitor() -> List[Dict[str, Any]]:
    """Monitor wallet activity and record flagged passive actions."""
    events = _load_json(EVENT_LOG, [])
    buffer = _load_json(BUFFER_PATH, [])
    flagged: List[Dict[str, Any]] = []
    for e in events:
        wallet = e.get('wallet')
        action = e.get('action')
        entry = {
            'timestamp': e.get('timestamp') or datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
            'wallet': wallet,
            'action': action,
        }
        buffer.append(entry)
        if action in {'login', 'overlay_use', 'ns3_interaction'}:
            flagged.append(entry)
    _write_json(BUFFER_PATH, buffer)
    return flagged


if __name__ == '__main__':
    print(json.dumps(monitor(), indent=2))
