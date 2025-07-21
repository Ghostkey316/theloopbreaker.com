# Reference: ethics/core.mdx
"""Governance submodule for electing ethical stewards and moderating proposals."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parents[1]
GOV_DIR = BASE_DIR / "governance"
STEWARD_VOTES_PATH = GOV_DIR / "steward_votes.json"
STEWARDS_PATH = GOV_DIR / "stewards.json"
PROPOSALS_PATH = GOV_DIR / "proposals.json"
FLAGS_PATH = GOV_DIR / "flags.json"


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


# ---------------------------------------------------------------------------
# Steward election
# ---------------------------------------------------------------------------

def nominate_steward(user_id: str) -> None:
    """Ensure ``user_id`` exists as a steward candidate."""
    votes = _load_json(STEWARD_VOTES_PATH, {})
    votes.setdefault(user_id, [])
    _write_json(STEWARD_VOTES_PATH, votes)


def vote_steward(voter_id: str, candidate_id: str) -> None:
    """Record ``voter_id``'s vote for ``candidate_id``."""
    votes = _load_json(STEWARD_VOTES_PATH, {})
    for cand in votes.values():
        if voter_id in cand:
            return  # one vote per voter
    votes.setdefault(candidate_id, []).append(voter_id)
    _write_json(STEWARD_VOTES_PATH, votes)


def elect_stewards() -> List[str]:
    """Elect top three candidates by vote count."""
    votes: Dict[str, List[str]] = _load_json(STEWARD_VOTES_PATH, {})
    ranked = sorted(votes.items(), key=lambda x: len(x[1]), reverse=True)
    winners = [c for c, _ in ranked[:3]]
    _write_json(STEWARDS_PATH, winners)
    return winners


# ---------------------------------------------------------------------------
# Proposal management
# ---------------------------------------------------------------------------

ETHICAL_VALUES = {"truth", "loyalty", "transparency"}
DECISION_DELAY_HOURS = 24


def submit_proposal(author: str, description: str) -> Dict:
    """Create a new proposal in pending state."""
    proposals = _load_json(PROPOSALS_PATH, [])
    pid = f"p{len(proposals) + 1:03d}"
    entry = {
        "id": pid,
        "author": author,
        "description": description,
        "status": "pending",
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    proposals.append(entry)
    _write_json(PROPOSALS_PATH, proposals)
    return entry


def flag_proposal(proposal_id: str, reason: str, anonymous: bool = True) -> None:
    """Flag ``proposal_id`` for violating ``reason`` anonymously by default."""
    if reason not in ETHICAL_VALUES:
        raise ValueError("invalid reason")
    flags = _load_json(FLAGS_PATH, [])
    flags.append({
        "proposal_id": proposal_id,
        "reason": reason,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "anonymous": anonymous,
    })
    _write_json(FLAGS_PATH, flags)


def _freeze(proposal: Dict, reason: str) -> None:
    proposal["status"] = "frozen"
    proposal["freeze_reason"] = reason
    proposal["freeze_time"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def review_flags(min_delay_hours: int = DECISION_DELAY_HOURS) -> List[str]:
    """Freeze proposals flagged beyond ``min_delay_hours`` ago."""
    proposals = _load_json(PROPOSALS_PATH, [])
    flags = _load_json(FLAGS_PATH, [])
    now = datetime.utcnow()
    changed = []
    for flag in flags:
        pid = flag.get("proposal_id")
        reason = flag.get("reason")
        ts = flag.get("timestamp")
        try:
            t = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            continue
        if now - t < timedelta(hours=min_delay_hours):
            continue
        for prop in proposals:
            if prop.get("id") == pid and prop.get("status") == "pending":
                _freeze(prop, reason)
                changed.append(pid)
                break
    if changed:
        _write_json(PROPOSALS_PATH, proposals)
    return changed


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Governance utilities")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("elect")

    p_prop = sub.add_parser("proposal")
    p_prop.add_argument("author")
    p_prop.add_argument("text")

    p_flag = sub.add_parser("flag")
    p_flag.add_argument("pid")
    p_flag.add_argument("reason")
    p_flag.add_argument("--id", help="flagger id")

    args = parser.parse_args()
    if args.cmd == "elect":
        print(json.dumps(elect_stewards(), indent=2))
    elif args.cmd == "proposal":
        print(json.dumps(submit_proposal(args.author, args.text), indent=2))
    elif args.cmd == "flag":
        flag_proposal(args.pid, args.reason, anonymous=not bool(args.id))
        review_flags()
    else:
        parser.print_help()
