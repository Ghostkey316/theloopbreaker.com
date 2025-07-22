"""Decentralized Cure Locker for community-sourced healing protocols."""

from __future__ import annotations

import json
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
LOCKER_PATH = BASE_DIR / "knowledge_repo" / "data" / "cure_locker.json"
VOTES_PATH = BASE_DIR / "governance" / "cure_votes.json"


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
# Cure submissions
# ---------------------------------------------------------------------------

def submit_cure(
    method: str,
    details: str,
    contributor: Optional[str] = None,
    *,
    pseudonym: Optional[str] = None,
    anonymous: bool = False,
) -> Dict:
    """Add a new cure entry with timestamped verification."""
    data: List[Dict] = _load_json(LOCKER_PATH, [])
    cid = f"c{len(data) + 1:03d}"
    entry: Dict[str, Optional[str]] = {
        "id": cid,
        "method": method,
        "details": details,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if not anonymous and contributor:
        entry["contributor"] = contributor
    elif contributor:
        entry["contributor_hash"] = sha256(contributor.encode()).hexdigest()[:8]
    if pseudonym:
        entry["pseudonym"] = pseudonym
    data.append(entry)
    _write_json(LOCKER_PATH, data)
    return entry


def list_cures() -> List[Dict]:
    """Return all saved cure entries."""
    return _load_json(LOCKER_PATH, [])


# ---------------------------------------------------------------------------
# Voting
# ---------------------------------------------------------------------------

def vote_cure(cure_id: str, voter_id: str, approve: bool, tx_hash: str) -> Dict:
    """Record an on-chain vote for ``cure_id`` using ``tx_hash``."""
    if not tx_hash.startswith("0x") or len(tx_hash) != 66:
        raise ValueError("invalid transaction hash")
    votes: Dict[str, List[Dict]] = _load_json(VOTES_PATH, {})
    record = {
        "voter": voter_id,
        "approve": approve,
        "tx": tx_hash,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    votes.setdefault(cure_id, []).append(record)
    _write_json(VOTES_PATH, votes)
    return record


def tally_votes(cure_id: str) -> Dict[str, int]:
    """Return ``yes`` and ``no`` vote counts for ``cure_id``."""
    votes: Dict[str, List[Dict]] = _load_json(VOTES_PATH, {})
    records = votes.get(cure_id, [])
    yes = sum(1 for v in records if v.get("approve"))
    no = sum(1 for v in records if not v.get("approve"))
    return {"yes": yes, "no": no}


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print(json.dumps(list_cures(), indent=2))
    else:
        cid = sys.argv[1]
        print(json.dumps(tally_votes(cid), indent=2))

