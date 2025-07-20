"""Simple Vaultfire activation logger."""

from datetime import datetime
import os
import argparse

DEFAULT_IDENTITY = "Ghostkey-316"
DEFAULT_WALLET = "bpow20.cb.id"


def log_vaultfire_status(identity=DEFAULT_IDENTITY, wallet=DEFAULT_WALLET):
    """Write a timestamped activation message to the log file."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status = f"Vaultfire status: ACTIVE | Identity: {identity} | Wallet: {wallet}"
    log_entry = f"[{timestamp}] {status}\n"

    os.makedirs("logs", exist_ok=True)

    with open("logs/vaultfire_log.txt", "a") as log_file:
        log_file.write(log_entry)

    print(log_entry.strip())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Log Vaultfire activation")
    parser.add_argument(
        "--identity",
        default=DEFAULT_IDENTITY,
        help="Identity name to record",
    )
    parser.add_argument(
        "--wallet",
        default=DEFAULT_WALLET,
        help="Wallet identifier to record",
    )
    args = parser.parse_args()
    log_vaultfire_status(identity=args.identity, wallet=args.wallet)
