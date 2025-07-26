"""Execute retroactive loyalty backpay distribution."""
from __future__ import annotations

import json

from engine.retroactive_rewards import calculate_retro_rewards, write_retro_rewards


def main() -> None:
    rewards = calculate_retro_rewards()
    write_retro_rewards(rewards)
    print(json.dumps(rewards, indent=2))


if __name__ == "__main__":
    main()

