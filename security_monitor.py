"""Vaultfire security monitor.

Checks critical file hashes against a baseline and restores originals if they
are modified. Logs any incidents to ``vaultfire-core/ethics/self_audit_log.json``.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
BASELINE_PATH = BASE_DIR / "vaultfire-core" / "security_baseline.json"
BACKUP_DIR = BASE_DIR / "vaultfire-core" / "baseline_backups"
LOG_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "self_audit_log.json"


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


def _hash_file(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest()


def set_baseline(files: list[Path]) -> None:
    baseline = {}
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for file in files:
        h = _hash_file(file)
        baseline[str(file.relative_to(BASE_DIR))] = h
        backup_path = BACKUP_DIR / file.name
        backup_path.write_bytes(file.read_bytes())
    _write_json(BASELINE_PATH, baseline)


def check_integrity(repair: bool = False) -> list[dict]:
    baseline = _load_json(BASELINE_PATH, {})
    incidents = []
    for rel_path, expected_hash in baseline.items():
        file_path = BASE_DIR / rel_path
        if not file_path.exists():
            incidents.append({"file": rel_path, "issue": "missing"})
            continue
        current_hash = _hash_file(file_path)
        if current_hash != expected_hash:
            incidents.append({
                "file": rel_path,
                "issue": "modified",
                "expected": expected_hash,
                "found": current_hash,
            })
            if repair:
                backup_path = BACKUP_DIR / file_path.name
                if backup_path.exists():
                    file_path.write_bytes(backup_path.read_bytes())
    if incidents:
        log = _load_json(LOG_PATH, [])
        ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        for item in incidents:
            item["timestamp"] = ts
            log.append(item)
        _write_json(LOG_PATH, log)
    return incidents


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Vaultfire security monitor")
    parser.add_argument("--set-baseline", action="store_true",
                        help="record current file hashes as baseline")
    parser.add_argument("--repair", action="store_true",
                        help="restore files if integrity check fails")
    args = parser.parse_args(argv)

    files = [
        BASE_DIR / "ethics" / "core.mdx",
        BASE_DIR / "vaultfire-core" / "vaultfire_config.json",
    ]

    if args.set_baseline:
        set_baseline(files)
        print("Baseline saved")
        return 0

    incidents = check_integrity(repair=args.repair)
    if incidents:
        print(json.dumps({"status": "FAIL", "incidents": incidents}, indent=2))
        return 1
    print(json.dumps({"status": "PASS"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
