"""Mission ledger primitives for metadata-rich Vaultfire operations."""

from __future__ import annotations

import json
import os
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterator, Mapping, MutableMapping, Optional, Sequence

LEDGER_PATH_ENV = "VAULTFIRE_MISSION_LEDGER_PATH"
_DEFAULT_LEDGER_NAME = "mission-ledger.jsonl"


@dataclass(frozen=True)
class LedgerMetadata:
    """Structured metadata stored alongside mission ledger records."""

    partner_id: Optional[str] = None
    narrative: Optional[str] = None
    diligence_artifacts: Sequence[str] = field(default_factory=tuple)
    region: str = "global"
    tags: Sequence[str] = field(default_factory=tuple)
    extra: Mapping[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "partner_id": self.partner_id,
            "narrative": self.narrative,
            "diligence_artifacts": list(self.diligence_artifacts),
            "region": self.region,
            "tags": list(self.tags),
            "extra": dict(self.extra),
        }


@dataclass(frozen=True)
class MissionRecord:
    """Representation of a mission ledger entry."""

    record_id: str
    category: str
    component: Optional[str]
    payload: Mapping[str, Any]
    metadata: LedgerMetadata
    timestamp: str
    schema_version: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "category": self.category,
            "component": self.component,
            "timestamp": self.timestamp,
            "schema_version": self.schema_version,
            "payload": dict(self.payload),
            "metadata": self.metadata.to_dict(),
        }


class MissionLedger:
    """Durable ledger used to persist mission critical metadata."""

    def __init__(
        self,
        *,
        path: Optional[Path] = None,
        component: Optional[str] = None,
        schema_version: str = "2025.07",
    ) -> None:
        self._path = (path or _resolve_default_path()).expanduser()
        self._component = component
        self._schema_version = schema_version
        self._lock = threading.RLock()
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def append(
        self,
        category: str,
        payload: Mapping[str, Any],
        metadata: LedgerMetadata | Mapping[str, Any] | None = None,
    ) -> MissionRecord:
        """Append a record to the mission ledger and return the stored entry."""

        meta = _normalise_metadata(metadata)
        record = MissionRecord(
            record_id=str(uuid.uuid4()),
            category=category,
            component=self._component,
            payload=dict(payload),
            metadata=meta,
            timestamp=datetime.now(tz=timezone.utc).isoformat(),
            schema_version=self._schema_version,
        )
        with self._lock:
            with self._path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(record.to_dict(), sort_keys=True) + "\n")
        return record

    def iter(self, *, category: Optional[str] = None) -> Iterator[MissionRecord]:
        """Iterate over stored records, optionally filtered by category."""

        if not self._path.exists():
            return iter(())
        with self._lock:
            with self._path.open("r", encoding="utf-8") as handle:
                lines = list(handle)
        records = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                payload: MutableMapping[str, Any] = json.loads(line)
            except json.JSONDecodeError:
                continue
            if category and payload.get("category") != category:
                continue
            records.append(_record_from_payload(payload))
        return iter(records)

    def lookup(self, record_id: str) -> Optional[MissionRecord]:
        """Fetch a record by identifier if it exists."""

        for record in self.iter():
            if record.record_id == record_id:
                return record
        return None

    def verify_artifact(self, artifact_id: str) -> bool:
        """Check whether an artifact identifier is referenced in the ledger."""

        for record in self.iter():
            if artifact_id in record.metadata.diligence_artifacts:
                return True
        return False

    def regional_snapshot(self, region: str) -> Sequence[Dict[str, Any]]:
        """Return records associated with a region for distributed diagnostics."""

        snapshot = []
        for record in self.iter():
            if record.metadata.region == region:
                snapshot.append(
                    {
                        "record_id": record.record_id,
                        "category": record.category,
                        "component": record.component,
                        "timestamp": record.timestamp,
                        "tags": list(record.metadata.tags),
                    }
                )
        return snapshot

    def metadata_template(
        self,
        *,
        partner_id: Optional[str] = None,
        narrative: Optional[str] = None,
        diligence_artifacts: Sequence[str] | None = None,
        region: str = "global",
        tags: Sequence[str] | None = None,
        extra: Mapping[str, Any] | None = None,
    ) -> LedgerMetadata:
        return LedgerMetadata(
            partner_id=partner_id,
            narrative=narrative,
            diligence_artifacts=tuple(diligence_artifacts or ()),
            region=region,
            tags=tuple(tags or ()),
            extra=dict(extra or {}),
        )

    @classmethod
    def default(cls, *, component: Optional[str] = None) -> "MissionLedger":
        return _default_ledger(component)

    @classmethod
    def reset_default_cache(cls) -> None:
        _default_ledger.cache_clear()


def _normalise_metadata(metadata: LedgerMetadata | Mapping[str, Any] | None) -> LedgerMetadata:
    if metadata is None:
        return LedgerMetadata()
    if isinstance(metadata, LedgerMetadata):
        return metadata
    return LedgerMetadata(
        partner_id=metadata.get("partner_id"),
        narrative=metadata.get("narrative"),
        diligence_artifacts=tuple(metadata.get("diligence_artifacts", ())),
        region=metadata.get("region", "global"),
        tags=tuple(metadata.get("tags", ())),
        extra=dict(metadata.get("extra", {})),
    )


def _record_from_payload(payload: Mapping[str, Any]) -> MissionRecord:
    metadata = LedgerMetadata(
        partner_id=payload.get("metadata", {}).get("partner_id"),
        narrative=payload.get("metadata", {}).get("narrative"),
        diligence_artifacts=tuple(payload.get("metadata", {}).get("diligence_artifacts", ())),
        region=payload.get("metadata", {}).get("region", "global"),
        tags=tuple(payload.get("metadata", {}).get("tags", ())),
        extra=dict(payload.get("metadata", {}).get("extra", {})),
    )
    return MissionRecord(
        record_id=str(payload.get("record_id")),
        category=str(payload.get("category")),
        component=payload.get("component"),
        payload=dict(payload.get("payload", {})),
        metadata=metadata,
        timestamp=str(payload.get("timestamp")),
        schema_version=str(payload.get("schema_version", "2025.07")),
    )


def _resolve_default_path() -> Path:
    env = os.getenv(LEDGER_PATH_ENV)
    if env:
        candidate = Path(env).expanduser()
        if candidate.is_dir():
            return candidate / _DEFAULT_LEDGER_NAME
        return candidate
    return Path("vaultfire-core") / _DEFAULT_LEDGER_NAME


@lru_cache(maxsize=8)
def _default_ledger(component: Optional[str]) -> MissionLedger:
    return MissionLedger(component=component)


__all__ = [
    "LedgerMetadata",
    "MissionLedger",
    "MissionRecord",
]
