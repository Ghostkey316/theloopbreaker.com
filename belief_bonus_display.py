"""Display belief multiplier and flame tier."""
from __future__ import annotations

import argparse
import json

from engine.belief_multiplier import belief_multiplier


def display_bonus(user_id: str, output: str = "cli") -> dict:
    mult, tier = belief_multiplier(user_id)
    result = {"user_id": user_id, "flame_tier": tier, "multiplier": mult}
    if output == "json":
        print(json.dumps(result, indent=2))
    else:
        print(f"{user_id}: {tier} ({mult}x)")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Show belief bonus status")
    parser.add_argument("user_id")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    display_bonus(args.user_id, output="json" if args.json else "cli")


if __name__ == "__main__":
    main()
