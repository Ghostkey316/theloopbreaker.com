"""Run global sync pulse for all users."""

import argparse
import json

from engine.sync_protocol import global_sync_pulse


def main():
    parser = argparse.ArgumentParser(description="Run global sync pulse")
    parser.add_argument(
        "--users",
        default="user_list.json",
        help="Path to JSON file containing list of user IDs",
    )
    args = parser.parse_args()

    try:
        with open(args.users) as f:
            user_list = json.load(f)
    except FileNotFoundError:
        user_list = []

    global_sync_pulse(user_list)


if __name__ == "__main__":
    main()

