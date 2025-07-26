import argparse
import json
import time
from pathlib import Path

from belief_trigger_engine import (
    high_tier_reward,
    mid_tier_reward,
    loyalty_ping,
    belief_boost_suggestion,
)

SCORES_PATH = Path('live_wallet_scores.json')


def scan_loop(iterations: int = 1, delay: float = 2.0) -> None:
    for _ in range(iterations):
        try:
            data = json.loads(SCORES_PATH.read_text())
        except Exception:
            data = {}
        for wallet, score in data.items():
            if score >= 90:
                high_tier_reward(wallet)
            elif score >= 70:
                mid_tier_reward(wallet)
            elif score >= 50:
                loyalty_ping(wallet)
            else:
                belief_boost_suggestion(wallet)
        time.sleep(delay)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Live flame scan')
    parser.add_argument('--iterations', type=int, default=1)
    parser.add_argument('--delay', type=float, default=2.0)
    args = parser.parse_args()
    scan_loop(args.iterations, args.delay)
