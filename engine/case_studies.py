"""Record and query anonymized natural treatment case studies."""
from __future__ import annotations

import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from knowledge_repo.query import by_condition

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "knowledge_repo" / "data" / "case_studies.json"


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


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def submit_case_study(
    condition: str,
    treatment: str,
    notes: str = "",
    pseudonym: Optional[str] = None,
) -> Dict:
    """Store a case study entry and return it."""
    identifier = pseudonym or str(datetime.utcnow().timestamp())
    hashed = _hash(identifier)
    studies = _load_json(DATA_PATH, [])
    matches = [e["treatment"] for e in by_condition(condition)]
    entry = {
        "id": hashed,
        "pseudonym": pseudonym,
        "condition": condition,
        "treatment": treatment,
        "notes": notes,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "matches": matches,
    }
    studies.append(entry)
    _write_json(DATA_PATH, studies)
    return entry


def list_case_studies(condition: Optional[str] = None) -> List[Dict]:
    """Return recorded case studies, optionally filtered by condition."""
    studies = _load_json(DATA_PATH, [])
    if condition:
        condition = condition.lower()
        studies = [s for s in studies if s.get("condition", "").lower() == condition]
    return studies
