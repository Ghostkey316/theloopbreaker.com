from __future__ import annotations

"""Customize MirrorForge belief forks with optional metadata."""

import json
from pathlib import Path
from typing import Dict

from .mirrorforge_3d_output import BASE_DIR, DEFAULT_WALLET


def customize_belief_fork(
    belief_id: str,
    metadata: Dict,
    wallet: str = DEFAULT_WALLET,
) -> Dict:
    """Attach ``metadata`` to the manifest entry matching ``belief_id``."""
    base = BASE_DIR / wallet
    if not base.exists():
        raise ValueError("wallet not found")

    for obj_dir in base.iterdir():
        manifest = obj_dir / "manifest.json"
        if not manifest.exists():
            continue
        try:
            data = json.loads(manifest.read_text())
        except Exception:
            data = []
        changed = False
        record: Dict | None = None
        for entry in data:
            if entry.get("belief_id") == belief_id:
                entry["customization"] = metadata
                record = entry
                changed = True
        if changed:
            manifest.write_text(json.dumps(data, indent=2))
            return record or {}
    raise ValueError("belief_id not found")


__all__ = ["customize_belief_fork"]
