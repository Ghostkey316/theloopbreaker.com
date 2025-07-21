# Reference: ethics/core.mdx
"""Behavioral yield distribution model for Vaultfire Core."""

import json
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parents[1] / "vaultfire_config.json"

POINTS = {
    "mission_complete": 10,
    "help_new_user": 5,
    "ethical_action": 7,
}


def _load_config():
    with open(CONFIG_PATH) as cfg:
        return json.load(cfg)


def calculate_yield(user_actions):
    """Return yield distribution based on recorded behaviors."""
    config = _load_config()
    if not config.get("ethics_anchor"):
        raise RuntimeError("Ethics anchor disabled. Halt monetization.")

    totals = {}
    for user, actions in user_actions.items():
        score = sum(POINTS.get(action, 0) for action in actions)
        totals[user] = score

    grand_total = sum(totals.values()) or 1
    return {user: score / grand_total for user, score in totals.items()}


if __name__ == "__main__":
    # Example usage
    sample = {
        "alice": ["mission_complete", "help_new_user"],
        "bob": ["ethical_action"],
    }
    print(calculate_yield(sample))
