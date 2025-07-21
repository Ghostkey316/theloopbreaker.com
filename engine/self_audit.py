# Reference: ethics/core.mdx
"""Self-audit checks for the Vaultfire protocol."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

from .truth_guard import HYPE_PATTERNS, PROFIT_PATTERNS, MANIPULATION_PATTERNS

BASE_DIR = Path(__file__).resolve().parents[1]
LEDGER_PATH = BASE_DIR / "logs" / "token_ledger.json"
PARTNERS_PATH = BASE_DIR / "partners.json"
OUTPUT_LOG_PATH = BASE_DIR / "event_log.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
AUDIT_LOG_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "self_audit_log.json"
HALT_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "halt.flag"
LAST_RUN_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "last_audit.json"


# ---------------------------------------------------------------------------


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


def _log_audit(entry) -> None:
    log = _load_json(AUDIT_LOG_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    log.append({"timestamp": timestamp, **entry})
    _write_json(AUDIT_LOG_PATH, log)


# ---------------------------------------------------------------------------
# Audit helpers


def audit_reward_fairness() -> list[str]:
    issues = []
    ledger = _load_json(LEDGER_PATH, [])
    rewards = {}
    for entry in ledger:
        amt = entry.get("amount", 0)
        if amt > 0:
            wallet = entry.get("wallet")
            rewards[wallet] = rewards.get(wallet, 0) + amt
    total = sum(rewards.values())
    if not total:
        return issues
    for wallet, amt in rewards.items():
        if amt / total > 0.5:
            issues.append(f"reward concentration >50% for {wallet}")
    return issues


def _matches_patterns(text: str) -> bool:
    import re

    patterns = list(HYPE_PATTERNS) + list(PROFIT_PATTERNS) + list(MANIPULATION_PATTERNS)
    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def audit_outputs() -> list[str]:
    issues = []
    logs = _load_json(OUTPUT_LOG_PATH, [])
    for entry in logs:
        text = json.dumps(entry, ensure_ascii=False) if isinstance(entry, dict) else str(entry)
        if _matches_patterns(text):
            issues.append("hype or manipulation detected in outputs")
            break
    return issues


def audit_partner_behavior() -> list[str]:
    issues = []
    partners = _load_json(PARTNERS_PATH, [])
    for p in partners:
        if not p.get("aligned"):
            issues.append(f"partner {p.get('partner_id')} not aligned")
    return issues


def audit_data_transparency() -> list[str]:
    issues = []
    logs_present = OUTPUT_LOG_PATH.exists() and OUTPUT_LOG_PATH.stat().st_size > 0
    ledger_present = LEDGER_PATH.exists() and LEDGER_PATH.stat().st_size > 0
    if not logs_present or not ledger_present:
        issues.append("missing or empty logs")
    return issues


# ---------------------------------------------------------------------------
# Halting logic


def halt_protocol(reason: str) -> None:
    _write_json(HALT_PATH, {"reason": reason, "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")})


# ---------------------------------------------------------------------------
# Scheduling helpers


def due_for_audit() -> bool:
    data = _load_json(LAST_RUN_PATH, {})
    ts = data.get("timestamp")
    if not ts:
        return True
    last = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")
    return datetime.utcnow() - last >= timedelta(days=90)


def update_last_run() -> None:
    _write_json(LAST_RUN_PATH, {"timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")})


# ---------------------------------------------------------------------------


def run_self_audit() -> dict:
    result = {
        "reward_fairness": audit_reward_fairness(),
        "output_truth": audit_outputs(),
        "partner_ethics": audit_partner_behavior(),
        "data_transparency": audit_data_transparency(),
    }
    _log_audit(result)
    if any(result.values()):
        halt_protocol("issues detected")
    update_last_run()
    return result


if __name__ == "__main__":
    if due_for_audit():
        res = run_self_audit()
        print(json.dumps(res, indent=2))
    else:
        print("Audit not due yet")
