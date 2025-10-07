"""Protocol manifest utilities for recording Vaultfire confirmations."""

from __future__ import annotations

from collections.abc import Iterable as IterableABC
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping, MutableSequence, Sequence

__all__ = ["CodexConfirmationSeal"]


def _now_ts() -> str:
    """Return a timezone-aware ISO 8601 timestamp."""
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class _ConfirmationRecord:
    timestamp: str
    version: str
    modules: Sequence[str]
    features: Sequence[str]
    verified_by: str | None
    lead: str | None
    payload: Mapping[str, object]

    def to_payload(self) -> Mapping[str, object]:
        data = dict(self.payload)
        data.update(
            {
                "timestamp": self.timestamp,
                "version": self.version,
                "modules": list(self.modules),
                "features": list(self.features),
                "verified_by": self.verified_by,
                "lead": self.lead,
            }
        )
        return data


@dataclass(frozen=True)
class _CommitLog:
    timestamp: str
    message: str

    def to_payload(self) -> Mapping[str, object]:
        return {"timestamp": self.timestamp, "message": self.message}


class CodexConfirmationSeal:
    """In-memory registry for protocol confirmation metadata.

    The confirmation seal is intentionally lightweight so it can run inside
    integration tests without requiring persistent storage. Records are stored
    in deterministic order and normalised for easier assertions.
    """

    _records: MutableSequence[_ConfirmationRecord] = []
    _logs: MutableSequence[_CommitLog] = []

    @classmethod
    def now(cls) -> str:
        """Expose the timestamp helper for callers that need synchronisation."""
        return _now_ts()

    @classmethod
    def record(cls, payload: Mapping[str, object]) -> Mapping[str, object]:
        """Record a manifest entry with normalised fields.

        Parameters
        ----------
        payload:
            Arbitrary mapping of manifest data. ``modules`` and ``features``
            are coerced to tuples to make the stored value immutable. Missing
            timestamps are automatically populated with the current UTC time.
        """

        if not isinstance(payload, Mapping):
            raise TypeError("record payload must be a mapping")

        timestamp = str(payload.get("timestamp") or cls.now())
        version = str(payload.get("version", "unknown"))
        modules = cls._normalise_sequence(payload.get("modules"))
        features = cls._normalise_sequence(payload.get("features"))
        verified_by = cls._optional_str(payload.get("verified_by"))
        lead = cls._optional_str(payload.get("lead"))

        record = _ConfirmationRecord(
            timestamp=timestamp,
            version=version,
            modules=modules,
            features=features,
            verified_by=verified_by,
            lead=lead,
            payload=dict(payload),
        )
        cls._records.append(record)
        return record.to_payload()

    @classmethod
    def commit_log(cls, message: str) -> Mapping[str, object]:
        if not isinstance(message, str):
            raise TypeError("commit_log message must be a string")
        entry = _CommitLog(timestamp=cls.now(), message=message.strip())
        cls._logs.append(entry)
        return entry.to_payload()

    @classmethod
    def history(cls) -> Mapping[str, Sequence[Mapping[str, object]]]:
        return {
            "records": tuple(record.to_payload() for record in cls._records),
            "logs": tuple(log.to_payload() for log in cls._logs),
        }

    @classmethod
    def last_record(cls) -> Mapping[str, object] | None:
        return cls._records[-1].to_payload() if cls._records else None

    @classmethod
    def last_log(cls) -> Mapping[str, object] | None:
        return cls._logs[-1].to_payload() if cls._logs else None

    @staticmethod
    def _normalise_sequence(values: object | None) -> Sequence[str]:
        if values is None:
            return ()
        if isinstance(values, str):
            return (values,)
        if isinstance(values, Mapping):
            candidates = values.values()
        elif isinstance(values, IterableABC):
            candidates = values
        else:  # pragma: no cover - defensive guard
            raise TypeError("sequence values must be iterable")
        return tuple(str(item) for item in candidates)

    @staticmethod
    def _optional_str(value: object | None) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

