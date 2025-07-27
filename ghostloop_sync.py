"""Ghostloop Activation Layer CLI."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from engine.purpose_engine import moral_memory_mirror
from engine.synergy_manager import record_synergy
from ghostkey_trader_notifications import notify_event

GROWTH_LOG = Path("logs/ghostkey_growth_log.json")


def _load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _run_signal_compass() -> List[Dict[str, Any]]:
    """Run signal_compass.js if possible and return results."""
    try:
        out = subprocess.check_output(["node", "signal_compass.js"])
        return json.loads(out.decode())
    except Exception:
        return _load_json(Path("signal_compass.json"), [])


def _growth_signature(user_id: str, fingerprint: Dict[str, Any]) -> str:
    token = f"{user_id}:{fingerprint.get('fingerprint', '')}:{datetime.utcnow().strftime('%Y-%m-%d')}"
    return hashlib.sha256(token.encode()).hexdigest()


def _log_growth(user_id: str, signature: str) -> None:
    log = _load_json(GROWTH_LOG, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "signature": signature,
    }
    log.append(entry)
    _write_json(GROWTH_LOG, log)


def _check_in(user_id: str, signature: str) -> None:
    payload = {"ticker": "SYNC", "action": "check_in", "confidence": 1.0, "user": user_id, "sig": signature}
    notify_event("companion_checkin", payload)


def sync_user(user_id: str, key: str = "vaultkey") -> Dict[str, Any]:
    """Run belief-state and memory sync for ``user_id``."""
    record_synergy(user_id)
    fingerprint = moral_memory_mirror(user_id)
    compass = _run_signal_compass()
    signature = _growth_signature(user_id, fingerprint)
    _log_growth(user_id, signature)
    _check_in(user_id, signature)
    return {"user_id": user_id, "signature": signature, "fingerprint": fingerprint, "compass": compass}


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ghostloop daily sync")
    parser.add_argument("--users", nargs="*", help="User IDs to sync (default from user_list.json)")
    args = parser.parse_args(argv)

    users = args.users
    if not users:
        users = _load_json(Path("user_list.json"), [])

    results = [sync_user(u) for u in users]
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
