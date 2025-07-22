"""Simple on-chain inventory tracking for game items."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parents[1]
INV_PATH = BASE_DIR / "logs" / "onchain_inventory.json"


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
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def add_item(user_id: str, item_id: str, tx_hash: str) -> Dict:
    """Record an item minted on-chain for ``user_id``."""
    data: Dict[str, List[Dict]] = _load_json(INV_PATH, {})
    items = data.setdefault(user_id, [])
    entry = {"item_id": item_id, "tx": tx_hash}
    items.append(entry)
    _write_json(INV_PATH, data)
    return entry


def list_items(user_id: str) -> List[Dict]:
    """Return inventory entries for ``user_id``."""
    data: Dict[str, List[Dict]] = _load_json(INV_PATH, {})
    return data.get(user_id, [])
