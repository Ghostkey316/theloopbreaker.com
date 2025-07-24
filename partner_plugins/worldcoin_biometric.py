from __future__ import annotations
from typing import Dict

from engine.worldcoin_layer import sync_orb_identity


def verify_worldcoin(user_id: str, world_id: str) -> Dict:
    """Verify Worldcoin identity via built-in worldcoin_layer."""
    return sync_orb_identity(user_id, world_id, True)


__all__ = ["verify_worldcoin"]
