#!/usr/bin/env python3
"""Vaultfire Protocol system readiness checker.

This script ensures that core Vaultfire files exist, performs a
validation sweep, and sets a readiness flag when all checks pass.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

BASE_DIR = Path(__file__).resolve().parent
AUDIT_PATH = BASE_DIR / "vaultfire_audit_report.txt"
READY_FLAG_PATH = BASE_DIR / "vaultfire_ready.flag"
PARTNER_FORK_PATH = BASE_DIR / "vaultbundle_partner_fork.json"

CORE_FILES = {
    "vaultfire_core.py": """from pathlib import Path
import json
from datetime import datetime
from engine.proof_of_loyalty import record_belief_action

PURPOSE_MAP_PATH = Path('purpose_map.json')


def sync_purpose(domain: str, trait: str, role: str) -> dict:
    record = {
        'domain': domain,
        'trait': trait,
        'role': role,
        'timestamp': datetime.utcnow().isoformat()
    }
    try:
        data = json.loads(PURPOSE_MAP_PATH.read_text())
    except Exception:
        data = {'records': []}
    data.setdefault('records', []).append(record)
    PURPOSE_MAP_PATH.write_text(json.dumps(data, indent=2))
    return record


def cli_belief(identity: str, wallet: str, text: str) -> dict:
    result = record_belief_action(identity, wallet, text)
    sync_purpose('cli', 'belief', 'record')
    return result
""",
    "fanforge_vr.py": """from pathlib import Path
import json
from datetime import datetime
import ghostseat
from engine.proof_of_loyalty import record_belief_action

LOG_PATH = Path('fanforge_vr_log.json')


def vr_check_in(identity: str, team: str) -> str:
    seat = ghostseat.assign_seat(identity, team)
    ghostseat.log_reaction(identity, seat, 'checkin')
    record_belief_action(identity, identity, f'{team} check-in')
    try:
        log = json.loads(LOG_PATH.read_text())
    except Exception:
        log = []
    log.append({'timestamp': datetime.utcnow().isoformat(), 'identity': identity, 'team': team})
    LOG_PATH.write_text(json.dumps(log, indent=2))
    return seat


def record_memory(identity: str, text: str) -> None:
    record_belief_action(identity, identity, text)
""",
    "loyalty_engine.py": """from engine.loyalty_engine import (
    loyalty_score,
    loyalty_enhanced_score,
    update_loyalty_ranks,
)

__all__ = ['loyalty_score', 'loyalty_enhanced_score', 'update_loyalty_ranks']
""",
    "ghostkey_registry.json": {"entries": []},
    "purpose_map.json": {"domains": {}, "traits": {}, "roles": {}, "records": [], "last_sync": ""},
}


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _log(msg: str) -> None:
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(AUDIT_PATH, "a") as f:
        f.write(f"[{timestamp}] {msg}\n")


def _ensure_files() -> None:
    for name, content in CORE_FILES.items():
        path = BASE_DIR / name
        if not path.exists():
            if isinstance(content, str):
                path.write_text(content)
            else:
                path.write_text(json.dumps(content, indent=2))
            _log(f"created {name}")


def _validate_scripts() -> List[str]:
    errors: List[str] = []
    for mod in ("vaultfire_core", "fanforge_vr", "loyalty_engine"):
        try:
            __import__(mod)
        except Exception as e:  # pragma: no cover - runtime validation
            errors.append(f"{mod} failed to import: {e}")
    return errors


def _validate_files() -> List[str]:
    errors: List[str] = []
    json_paths = [BASE_DIR / "ghostkey_registry.json", BASE_DIR / "purpose_map.json"]
    csv_paths = [BASE_DIR / "fan_cred_log.csv"]

    for path in json_paths:
        if not path.exists():
            errors.append(f"missing {path.name}")
            continue
        try:
            json.loads(path.read_text())
        except Exception as e:
            errors.append(f"invalid json in {path.name}: {e}")

    for path in csv_paths:
        if not path.exists():
            path.write_text("timestamp,identity,action,value,detail\n")
            _log(f"created {path.name}")
        else:
            try:
                list(csv.reader(path.read_text().splitlines()))
            except Exception as e:
                errors.append(f"invalid csv in {path.name}: {e}")
    return errors


def _simulate_actions() -> List[str]:
    errors: List[str] = []
    try:
        import vaultfire_core
        import fanforge_vr

        vaultfire_core.cli_belief("demo", "demo", "belief test")
        fanforge_vr.record_memory("demo", "memory test")
        fanforge_vr.vr_check_in("demo", "team")
    except Exception as e:
        errors.append(f"action simulation failed: {e}")
    return errors


def _generate_partner_fork(wallet: str) -> None:
    data = {
        "partner_wallet": wallet,
        "traits": ["origin"],
        "loyalty_tier": "default",
        "fork_origin": "ghostkey316.eth",
    }
    PARTNER_FORK_PATH.write_text(json.dumps(data, indent=2))
    _log(f"wrote {PARTNER_FORK_PATH.name}")


def _system_hash() -> str:
    h = hashlib.sha256()
    for name in sorted(CORE_FILES.keys()):
        path = BASE_DIR / name
        if path.exists():
            h.update(path.read_bytes())
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Vaultfire system readiness")
    parser.add_argument("--partner-mode", metavar="WALLET", help="generate partner fork")
    args = parser.parse_args(argv)

    _ensure_files()

    issues: List[str] = []
    issues += _validate_scripts()
    issues += _validate_files()
    issues += _simulate_actions()

    if args.partner_mode:
        _generate_partner_fork(args.partner_mode)

    moral_violations = []
    banned = {"gamble", "casino", "surveillance", "coercion"}
    for name in ("vaultfire_core.py", "fanforge_vr.py", "loyalty_engine.py"):
        text = (BASE_DIR / name).read_text().lower()
        if any(term in text for term in banned):
            moral_violations.append(f"banned term in {name}")
    issues += moral_violations

    if issues:
        for msg in issues:
            _log(f"ERROR: {msg}")
        return 1

    ready_info = {
        "hash": _system_hash(),
        "origin": "ghostkey316.eth",
        "timestamp": datetime.utcnow().isoformat(),
    }
    READY_FLAG_PATH.write_text(json.dumps(ready_info, indent=2))
    _log("system ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
