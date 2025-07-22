"""Protocol watchdog that monitors critical scripts for tampering."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Dict
import urllib.request

BASE_DIR = Path(__file__).resolve().parent
BACKUP_DIR = BASE_DIR / "backups"
LOG_DIR = BASE_DIR / "logs"
STATE_FILE = BACKUP_DIR / "guardian_state.json"
DEFAULT_FILES = [
    "vaultfire_signal.py",
    "engine/signal_engine.py",
    "engine/loyalty_engine.py",
]


def _hash_file(path: Path) -> str:
    """Return SHA256 digest for ``path``."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _load_state() -> Dict[str, str]:
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}


def _save_state(state: Dict[str, str]) -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def _log_entry(log_path: Path, message: str) -> None:
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "a") as f:
        f.write(f"{timestamp} {message}\n")


def _alert(message: str, webhook: str | None) -> None:
    if webhook:
        data = json.dumps({"text": message}).encode()
        req = urllib.request.Request(webhook, data=data, headers={"Content-Type": "application/json"})
        try:
            urllib.request.urlopen(req, timeout=5)
        except Exception:
            pass
    else:
        print(message)


def _ensure_backup(path: Path, rel: str, state: Dict[str, str]) -> None:
    """Create backup and state entry if missing."""
    if rel not in state:
        backup_path = BACKUP_DIR / f"{rel}.bak"
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, backup_path)
        state[rel] = _hash_file(path)


class Guardian:
    def __init__(self, files: list[str], interval: int, webhook: str | None, test_mode: bool = False):
        self.files = [BASE_DIR / f for f in files]
        self.interval = interval
        self.webhook = webhook
        self.test_mode = test_mode
        self.log_path = LOG_DIR / f"guardian_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.log"
        self.state = _load_state()
        for file_path, rel in [(p, str(Path(p).relative_to(BASE_DIR))) for p in self.files]:
            if file_path.exists():
                _ensure_backup(file_path, rel, self.state)
        _save_state(self.state)

    def run(self) -> None:
        while True:
            for file_path in self.files:
                rel = str(file_path.relative_to(BASE_DIR))
                if not file_path.exists():
                    continue
                current_hash = _hash_file(file_path)
                expected_hash = self.state.get(rel)
                tampered = current_hash != expected_hash
                if self.test_mode:
                    tampered = True
                    self.test_mode = False
                if tampered:
                    _log_entry(self.log_path, f"Change detected: {rel}")
                    backup_path = BACKUP_DIR / f"{rel}.bak"
                    if backup_path.exists():
                        shutil.copy2(backup_path, file_path)
                        _log_entry(self.log_path, f"Restored {rel} from backup")
                    self.state[rel] = _hash_file(file_path)
                    _save_state(self.state)
                    _alert(f"guardian_loop: {rel} modified and restored", self.webhook)
            time.sleep(self.interval)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Vaultfire watchdog")
    parser.add_argument("--files", nargs="*", default=DEFAULT_FILES, help="Files to monitor")
    parser.add_argument("--interval", type=int, default=60, help="Polling interval in seconds")
    parser.add_argument("--webhook", help="Optional webhook URL for alerts")
    parser.add_argument("--test-mode", action="store_true", help="Simulate tamper event")
    args = parser.parse_args(argv)

    guardian = Guardian(args.files, args.interval, args.webhook, args.test_mode)
    try:
        guardian.run()
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
