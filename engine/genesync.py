"""Opt-in GeneSync integration for anonymized biometric data."""
from __future__ import annotations

import json
import hashlib
from pathlib import Path
from typing import Dict, Optional

from .health_sync_engine import encrypt_data, decrypt_data

BASE_DIR = Path(__file__).resolve().parents[1]
GENE_DIR = BASE_DIR / "logs" / "gene_sync"

GENESYNC_WARNING = (
    "GeneSync is experimental. Handle genetic data responsibly and consult a "
    "professional before acting on any recommendation."
)


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


def _hash_id(identifier: str) -> str:
    return hashlib.sha256(identifier.encode()).hexdigest()


# ---------------------------------------------------------------------------

def link_gene_metrics(user_id: str, metrics: Dict[str, float], key: str) -> Dict[str, float]:
    """Store encrypted GeneSync metrics for ``user_id``."""
    hashed = _hash_id(user_id)
    path = GENE_DIR / f"{hashed}_metrics.json"
    token = encrypt_data(json.dumps(metrics), key)
    _write_json(path, {"token": token})
    return metrics


def get_gene_metrics(user_id: str, key: str) -> Optional[Dict[str, float]]:
    """Return decrypted GeneSync metrics for ``user_id`` if available."""
    hashed = _hash_id(user_id)
    path = GENE_DIR / f"{hashed}_metrics.json"
    data = _load_json(path, {})
    token = data.get("token")
    if not token:
        return None
    try:
        plain = decrypt_data(token, key)
        return json.loads(plain)
    except Exception:
        return None


def gene_risk_level(user_id: str, key: str) -> str:
    """Return risk level based on GeneSync metrics."""
    metrics = get_gene_metrics(user_id, key) or {}
    score = metrics.get("risk_score", 0.0)
    if score >= 0.7:
        return "high"
    if score >= 0.3:
        return "medium"
    return "low"


__all__ = [
    "link_gene_metrics",
    "get_gene_metrics",
    "gene_risk_level",
    "GENESYNC_WARNING",
]
