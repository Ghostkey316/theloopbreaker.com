from __future__ import annotations
import argparse
import time
from pathlib import Path
from datetime import datetime
from engine.feedback_loop import update_heartbeat

LOG_PATH = Path('Vaultfire/diagnostics/belief_stream.log')


def scan_once() -> None:
    pulse = update_heartbeat()
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, 'a') as f:
        f.write(f"{datetime.utcnow().isoformat()}Z {pulse}\n")
    print('belief pulse recorded')


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Belief Pulse Scanner')
    parser.add_argument('--loop', action='store_true', help='run continuously')
    parser.add_argument('--interval', type=int, default=60, help='seconds between scans')
    args = parser.parse_args(argv)
    if args.loop:
        while True:
            scan_once()
            time.sleep(args.interval)
    else:
        scan_once()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
