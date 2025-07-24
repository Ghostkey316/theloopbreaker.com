import argparse
import json
import random
from datetime import datetime
from pathlib import Path
from typing import List

BASE_DIR = Path(__file__).resolve().parent
LOG_PATH = BASE_DIR / "vaultfire_integrity_log.txt"
ETHICS_LOG_PATH = BASE_DIR / "vaultfire_ethics_report.txt"
READY_FLAG_PATH = BASE_DIR / "vaultfire_ready.flag"

REQUIRED = {
    "vaultfire_core.py": BASE_DIR / "vaultfire_core.py",
    "fanforge_vr.py": BASE_DIR / "fanforge_vr.py",
    "loyalty_engine.py": BASE_DIR / "engine" / "loyalty_engine.py",
    "vaultfire_fork_v2.py": BASE_DIR / "vaultfire_fork_v2.py",
    "ghostkey_registry.json": BASE_DIR / "ghostkey_registry.json",
    "purpose_map.json": BASE_DIR / "purpose_map.json",
    "vaultfire_audit_report.txt": BASE_DIR / "vaultfire_audit_report.txt",
    "vaultfire_ready.flag": READY_FLAG_PATH,
}

TEMPLATES = {
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
    "vaultfire_audit_report.txt": "",
    "vaultfire_ready.flag": "FALSE",
}

BANNED_TERMS = {
    "surveillance",
    "wager",
    "bet",
    "casino",
    "tracking",
    "bias toward wealth",
    "location bias",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log(message: str) -> None:
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(LOG_PATH, "a") as f:
        f.write(f"{timestamp} {message}\n")


def _ethics_log(message: str) -> None:
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(ETHICS_LOG_PATH, "a") as f:
        f.write(f"{timestamp} {message}\n")


def _write_template(name: str, path: Path) -> None:
    template = TEMPLATES.get(name)
    if template is None:
        return
    if isinstance(template, str):
        path.write_text(template)
    else:
        path.write_text(json.dumps(template, indent=2))
    _log(f"auto-created {name}")


# ---------------------------------------------------------------------------
# Integrity checks
# ---------------------------------------------------------------------------

def check_and_repair(force_registry: bool) -> List[str]:
    issues: List[str] = []
    for name, path in REQUIRED.items():
        if not path.exists():
            if name == "ghostkey_registry.json" and not force_registry:
                issues.append(f"missing {name} (needs confirmation)")
                _log(f"{name} missing - requires confirmation to create")
                continue
            _write_template(name, path)
            issues.append(f"{name} missing - regenerated")
        else:
            if name.endswith(".py"):
                try:
                    compile(path.read_text(), str(path), "exec")
                except Exception as e:
                    issues.append(f"{name} syntax error: {e}")
                    _write_template(name, path)
            elif name.endswith(".json"):
                try:
                    json.loads(path.read_text())
                except Exception as e:
                    issues.append(f"invalid json in {name}: {e}")
                    _write_template(name, path)
            elif path.stat().st_size == 0:
                issues.append(f"{name} empty")
                if name in TEMPLATES:
                    _write_template(name, path)
    return issues


# ---------------------------------------------------------------------------
# CLI Simulation
# ---------------------------------------------------------------------------

def run_cli_simulation(deep: bool) -> List[str]:
    issues: List[str] = []
    try:
        from engine.proof_of_loyalty import record_belief_action
        from engine.loyalty_engine import update_loyalty_ranks
        record_belief_action("demo", "demo.eth", "test belief")
        update_loyalty_ranks()
        pm_path = REQUIRED["purpose_map.json"]
        data = json.loads(pm_path.read_text())
        data.setdefault("records", []).append({"flow": "belief", "time": datetime.utcnow().isoformat()})
        pm_path.write_text(json.dumps(data, indent=2))
    except Exception as e:
        issues.append(f"belief-loyalty flow failed: {e}")

    try:
        import fanforge_vr  # type: ignore
        seat = fanforge_vr.vr_check_in("demo", "team")
        fanforge_vr.record_memory("demo", "memory")
        cred = BASE_DIR / "fan_cred_log.csv"
        if not cred.exists():
            cred.write_text("timestamp,identity,action,value,detail\n")
        with open(cred, "a") as f:
            f.write(f"{datetime.utcnow().isoformat()},demo,checkin,1,{seat}\n")
        pm_path = REQUIRED["purpose_map.json"]
        data = json.loads(pm_path.read_text())
        data.setdefault("records", []).append({"flow": "sports", "time": datetime.utcnow().isoformat()})
        pm_path.write_text(json.dumps(data, indent=2))
    except Exception as e:
        issues.append(f"sports flow failed: {e}")

    try:
        import vaultfire_fork_v2
        wallets = [f"demo{i}.eth" for i in range(1, 4)] if deep else ["demo.eth"]
        for w in wallets:
            args = argparse.Namespace(
                source_protocol="vaultfire_v1.json",
                partner_wallet=w,
                ethics_locked=True,
                yield_profile="basic",
                loyalty_engine="ghostkey316.logic",
                manifesto=False,
                token_gate=None,
                expiration=None,
            )
            vaultfire_fork_v2.generate_bundle(args)
    except Exception as e:
        issues.append(f"partner fork flow failed: {e}")
    return issues


# ---------------------------------------------------------------------------
# Ethics enforcement
# ---------------------------------------------------------------------------

def enforce_ethics() -> List[str]:
    violations: List[str] = []
    for name in ("vaultfire_core.py", "fanforge_vr.py", "loyalty_engine.py", "vaultfire_fork_v2.py"):
        path = REQUIRED[name]
        if not path.exists():
            continue
        lines = path.read_text().splitlines()
        modified = False
        for i, line in enumerate(lines):
            lower = line.lower()
            if any(term in lower for term in BANNED_TERMS):
                violations.append(f"{name}:{i+1}")
                lines[i] = f"# ETHICS VIOLATION REMOVED: {line}"
                modified = True
        if modified:
            path.write_text("\n".join(lines))
    for v in violations:
        _ethics_log(v)
    return violations


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Vaultfire integrity pulse")
    parser.add_argument("--deep", action="store_true", help="run deep partner fork simulation")
    parser.add_argument("--repair-only", action="store_true", help="repair files without simulation")
    parser.add_argument("--force-registry", action="store_true", help="allow creation of ghostkey_registry.json")
    args = parser.parse_args(argv)

    LOG_PATH.write_text("")
    ETHICS_LOG_PATH.write_text("")

    issues = check_and_repair(force_registry=args.force_registry)
    ethics = enforce_ethics()

    if not args.repair_only:
        issues += run_cli_simulation(deep=args.deep)

    ready = not issues and not ethics
    if ready:
        READY_FLAG_PATH.write_text("TRUE")
        _log("system passed")
        print("System passed | No errors")
    else:
        READY_FLAG_PATH.write_text("FALSE")
        for msg in issues:
            _log(f"ERROR: {msg}")
        if ethics:
            _ethics_log("violations detected")
        print("Integrity issues detected")
        for msg in issues:
            print("-", msg)
        if ethics:
            print("- ethics violations: see vaultfire_ethics_report.txt")
    return 0 if ready else 1


if __name__ == "__main__":
    raise SystemExit(main())
