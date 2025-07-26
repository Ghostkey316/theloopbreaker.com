import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

BUFFER_PATH = Path('ghost_loop_buffer.json')
INTEL_MAP_PATH = Path('overlays/intel_map.json')
CONFIG_PATH = Path('configs/passive_sync.json')
TIER_PATH = Path('loyalty_tiers.json')


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


def vectorize() -> Dict[str, Any]:
    """Aggregate buffer entries and compute insight scores."""
    buf = _load_json(BUFFER_PATH, [])
    cfg = _load_json(CONFIG_PATH, {})
    mult = cfg.get('multipliers', {})
    scores: Dict[str, int] = {}
    for entry in buf:
        wallet = entry.get('wallet')
        action = entry.get('action')
        delta = 0
        if action == 'overlay_use':
            delta = 5
        elif action == 'tier_upgrade':
            delta = 10
        elif action == 'idle':
            delta = -3
        scores[wallet] = scores.get(wallet, 0) + delta
    tiers = _load_json(TIER_PATH, {})
    for wallet, score in scores.items():
        tier = tiers.get(wallet, {}).get('tier', 'Entry')
        m = mult.get(tier, 1.0)
        scores[wallet] = int(score * m)
    intel = _load_json(INTEL_MAP_PATH, {})
    ts = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    for wallet, score in scores.items():
        intel[wallet] = {'insightScore': score, 'lastSync': ts}
    _write_json(INTEL_MAP_PATH, intel)
    return intel


if __name__ == '__main__':
    print(json.dumps(vectorize(), indent=2))
