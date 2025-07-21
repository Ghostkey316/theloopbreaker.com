from __future__ import annotations
"""Shutdown management utilities for Vaultfire governance."""

import json
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
GOV_DIR = BASE_DIR / "governance"
PARTNERS_PATH = BASE_DIR / "partners.json"
SHUTDOWN_LOG_PATH = GOV_DIR / "shutdown_log.json"
SHUTDOWN_STATE_PATH = GOV_DIR / "shutdown_state.json"
SHUTDOWN_VOTES_PATH = GOV_DIR / "shutdown_votes.json"


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


def _log(entry) -> None:
    log = _load_json(SHUTDOWN_LOG_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    log.append({"timestamp": timestamp, **entry})
    _write_json(SHUTDOWN_LOG_PATH, log)


# ---------------------------------------------------------------------------
# Voting
# ---------------------------------------------------------------------------

def initiate_shutdown_vote(reason: str) -> dict:
    """Start a new shutdown vote."""
    state = {
        "reason": reason,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "active": True,
    }
    _write_json(SHUTDOWN_STATE_PATH, state)
    _write_json(SHUTDOWN_VOTES_PATH, {})
    _log({"action": "initiate_vote", "reason": reason})
    return state


def cast_vote(steward_id: str, approve: bool) -> dict:
    """Record ``steward_id`` vote on active shutdown proposal."""
    votes = _load_json(SHUTDOWN_VOTES_PATH, {})
    votes[steward_id] = approve
    _write_json(SHUTDOWN_VOTES_PATH, votes)
    _log({"action": "cast_vote", "steward": steward_id, "approve": approve})
    return votes


def tally_votes() -> bool:
    """Return True if majority of stewards approved shutdown."""
    votes = _load_json(SHUTDOWN_VOTES_PATH, {})
    stewards = _load_json(GOV_DIR / "stewards.json", [])
    yes = sum(1 for v in votes.values() if v)
    required = max(1, len(stewards) // 2 + 1)
    approved = yes >= required
    _log({"action": "tally", "yes": yes, "required": required, "approved": approved})
    if approved:
        activate_shutdown()
    return approved


# ---------------------------------------------------------------------------
# Shutdown actions
# ---------------------------------------------------------------------------

def activate_shutdown() -> None:
    """Pause partners and run transparency audit."""
    partners = _load_json(PARTNERS_PATH, [])
    for p in partners:
        p["paused"] = True
    _write_json(PARTNERS_PATH, partners)
    _log({"action": "partners_paused", "count": len(partners)})

    from .self_audit import run_self_audit

    audit_result = run_self_audit()
    _log({"action": "transparency_audit", "result": audit_result})

    state = _load_json(SHUTDOWN_STATE_PATH, {})
    state["active"] = False
    state["shutdown"] = True
    _write_json(SHUTDOWN_STATE_PATH, state)

