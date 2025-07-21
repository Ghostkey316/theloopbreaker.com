"""Alignment key manager for Vaultfire."""

import argparse
import json
from datetime import datetime
from pathlib import Path

from engine.yield_engine_v1 import mark_yield_boost

BASE_DIR = Path(__file__).resolve().parent
PARTNERS_PATH = BASE_DIR / "partners.json"
ACCESS_LOG_PATH = BASE_DIR / "logs" / "alignment_access.json"

ALIGNMENT_PHRASE = "Morals Before Metrics."


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


def unlock_alignment(partner_id: str, phrase: str) -> dict:
    """Mark partner aligned and grant yield boost if phrase matches."""
    partners = _load_json(PARTNERS_PATH, [])
    updated = False
    for entry in partners:
        if entry.get("partner_id") == partner_id:
            if phrase.strip() == ALIGNMENT_PHRASE:
                entry["aligned"] = True
                mark_yield_boost(partner_id)
                updated = True
            break
    if updated:
        _write_json(PARTNERS_PATH, partners)
        log = _load_json(ACCESS_LOG_PATH, [])
        log.append({
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "partner_id": partner_id,
            "access_granted": True,
        })
        _write_json(ACCESS_LOG_PATH, log)
        return {"partner_id": partner_id, "access": "granted"}
    return {"partner_id": partner_id, "access": "denied"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unlock alignment for a partner")
    parser.add_argument("partner_id")
    parser.add_argument("phrase")
    args = parser.parse_args()

    result = unlock_alignment(args.partner_id, args.phrase)
    print(json.dumps(result, indent=2))
