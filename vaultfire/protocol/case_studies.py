"""Case study helpers for Vaultfire partner activations."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List

_REPO_ROOT = Path(__file__).resolve().parents[2]
_CASE_STUDY_PATH = _REPO_ROOT / "knowledge_repo" / "data" / "case_studies.json"


def _normalize_case_id(case_id: str) -> str:
    return case_id.strip().lower().replace("-", "_")


def _candidate_ids(entry: Dict[str, Any]) -> Iterable[str]:
    yield _normalize_case_id(str(entry.get("id", "")))
    mission_id = entry.get("mission_id")
    if mission_id:
        yield _normalize_case_id(str(mission_id))
    name = entry.get("name")
    if name:
        yield _normalize_case_id(str(name))


def _load_case_studies() -> List[Dict[str, Any]]:
    if not _CASE_STUDY_PATH.exists():
        return []
    try:
        return json.loads(_CASE_STUDY_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive guard
        raise ValueError(f"Unable to parse case study index: {exc}") from exc


def _write_case_studies(entries: Iterable[Dict[str, Any]]) -> None:
    data = list(entries)
    _CASE_STUDY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _CASE_STUDY_PATH.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        handle.write("\n")


def get_case_by_id(case_id: str) -> Dict[str, Any]:
    """Return the case study matching ``case_id``.

    ``case_id`` is matched case-insensitively and treats hyphens and underscores
    as interchangeable so ``Ghostkey-316`` and ``ghostkey_316`` resolve to the
    same record.
    """

    normalized = _normalize_case_id(case_id)
    for entry in _load_case_studies():
        candidates = {cid for cid in _candidate_ids(entry) if cid}
        if normalized in candidates:
            result = dict(entry)
            wallet = result.get("wallet")
            if wallet and "wallet_id" not in result:
                result["wallet_id"] = wallet
            result.setdefault("case_id", entry.get("id"))
            return result
    raise KeyError(f"No case study found for id '{case_id}'")


def mark_case_as_ready(case_id: str) -> Dict[str, Any]:
    """Mark ``case_id`` as enterprise ready and persist the update."""

    normalized = _normalize_case_id(case_id)
    entries = _load_case_studies()
    for entry in entries:
        if normalized in {cid for cid in _candidate_ids(entry) if cid}:
            entry["status"] = "enterprise_ready"
            entry["enterprise_ready"] = True
            entry["ready_timestamp"] = datetime.now(timezone.utc).isoformat()
            _write_case_studies(entries)
            result = dict(entry)
            wallet = result.get("wallet")
            if wallet and "wallet_id" not in result:
                result["wallet_id"] = wallet
            result.setdefault("case_id", entry.get("id"))
            return result
    raise KeyError(f"No case study found for id '{case_id}'")


__all__ = ["get_case_by_id", "mark_case_as_ready"]
