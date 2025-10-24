"""Ledger markers for Vaultfire reinforcement milestones."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Mapping, Sequence

from vaultfire.mission import MissionLedger

__all__ = ["record_protocol_markers"]


def _append_codex(path: Path, payload: Mapping[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        json.dump(dict(payload), handle, separators=(",", ":"))
        handle.write("\n")


def record_protocol_markers(
    markers: Sequence[str] | Iterable[str],
    *,
    codex_path: Path | None = None,
    mission_ledger: MissionLedger | None = None,
    extra: Mapping[str, object] | None = None,
) -> List[str]:
    """Persist ``markers`` to Codex memory and the mission ledger."""

    codex_target = (codex_path or Path("codex/VAULTFIRE_CLI_LEDGER.jsonl")).expanduser()
    ledger = mission_ledger or MissionLedger.default(component="protocol-reinforcement")
    record_ids: List[str] = []
    metadata_extra = dict(extra or {})
    for marker in markers:
        timestamp = datetime.now(timezone.utc).isoformat()
        _append_codex(
            codex_target,
            {
                "timestamp": timestamp,
                "event": "protocol-marker",
                "marker": marker,
                "tags": ["vaultfire-reinforcement-v3.1"],
            },
        )
        record = ledger.append(
            "protocol_marker",
            {"marker": marker, "timestamp": timestamp, "extra": metadata_extra},
            metadata={
                "tags": ("vaultfire-reinforcement-v3.1", marker),
                "extra": {"marker": marker, **metadata_extra},
            },
        )
        record_ids.append(record.record_id)
    return record_ids
