# Reference: ethics/core.mdx
"""Broadcast Vaultfire alignment beacon."""

import json
import hashlib
from pathlib import Path
from datetime import datetime

from vaultfire_signal import DEFAULT_IDENTITY, DEFAULT_WALLET
from engine.identity_resolver import resolve_identity
from record_signal_feed import update_signal_feed

BASE_DIR = Path(__file__).resolve().parent
ETHICS_PATH = BASE_DIR / "ethics" / "core.mdx"
LOG_PATH = BASE_DIR / "logs" / "beacon_log.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def ethics_checksum() -> str:
    """Return SHA256 checksum of the ethics core file."""
    data = ETHICS_PATH.read_bytes()
    return hashlib.sha256(data).hexdigest()


def activation_state(identity: str = DEFAULT_IDENTITY, wallet: str = DEFAULT_WALLET) -> str:
    """Return formatted activation state string and log entry."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    resolved = resolve_identity(wallet) or "unknown"
    status = f"Vaultfire status: ACTIVE | Identity: {identity} | Wallet: {wallet} ({resolved})"
    entry = f"[{timestamp}] {status}"
    log = _load_json(LOG_PATH, [])
    log.append({"timestamp": timestamp, "identity": identity, "wallet": wallet, "resolved": resolved})
    _write_json(LOG_PATH, log)
    print(entry)
    return status


def trigger_beacon():
    """Broadcast ethics checksum and activation state via signal feed."""
    checksum = ethics_checksum()
    activation = activation_state()
    beacon_entry = {
        "ethics_checksum": checksum[:10],
        "activation_state": activation,
        "market_ready": True,
    }
    result = update_signal_feed(beacon_entry)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    trigger_beacon()
