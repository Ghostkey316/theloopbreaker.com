"""Simulate belief tracking for demo wallets."""
from __future__ import annotations

import json

from engine.belief_multiplier import record_belief_action, belief_multiplier
from belief_bonus_display import display_bonus

MOCK_WALLETS = ["demo1.eth", "demo2.eth"]


def simulate() -> None:
    for w in MOCK_WALLETS:
        record_belief_action(w, "interaction")
        record_belief_action(w, "growth")
    record_belief_action("demo1.eth", "flame")
    results = {w: belief_multiplier(w)[0] for w in MOCK_WALLETS}
    print(json.dumps(results, indent=2))
    for w in MOCK_WALLETS:
        display_bonus(w)


if __name__ == "__main__":
    simulate()
