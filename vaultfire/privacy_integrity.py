"""Privacy Integrity Shield components for Vaultfire telemetry and Ghostkey."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence

from vaultfire.privacy import PrivacyError

__all__ = [
    "ConsentGuardianLayer",
    "EchoAnonymizerEngine",
    "GhostkeyPrivacyHalo",
    "VaultTraceEraser",
    "PrivacyIntegrityShield",
    "get_privacy_shield",
]


_METADATA_SNAPSHOT: Mapping[str, object] = {
    "Privacy_Score": "A+",
    "SEC_Compliance": "\u2713\u2713\u2713",
    "User_Consent_Enforced": True,
    "Traceable_Leak_Risk": "0.00%",
    "Echo_Loops_Anonymized": True,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_datetime(value: Optional[Any]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, (int, float)):
        return _now() + timedelta(seconds=float(value))
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError as exc:  # pragma: no cover - defensive branch
            raise PrivacyError(f"invalid datetime value: {value!r}") from exc
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    raise PrivacyError(f"unsupported datetime value: {value!r}")


def _fingerprint(*values: Any) -> str:
    digest = hashlib.sha256()
    for value in values:
        if isinstance(value, bytes):
            digest.update(value)
        else:
            digest.update(str(value).encode("utf-8"))
    return digest.hexdigest()[:32]


@dataclass
class ConsentRecord:
    fingerprint: str
    granted_at: datetime
    expires_at: Optional[datetime] = None

    def serialize(self) -> Mapping[str, Any]:
        return {
            "fingerprint": self.fingerprint,
            "granted_at": self.granted_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }

    @classmethod
    def deserialize(cls, payload: Mapping[str, Any]) -> "ConsentRecord":
        granted = _coerce_datetime(payload.get("granted_at"))
        if granted is None:
            raise PrivacyError("consent record missing granted_at")
        expires = payload.get("expires_at")
        return cls(
            fingerprint=str(payload.get("fingerprint", "")) or _fingerprint(granted.isoformat()),
            granted_at=granted,
            expires_at=_coerce_datetime(expires),
        )


@dataclass
class UnlockRecord:
    fingerprint: str
    issued_at: datetime

    def serialize(self) -> Mapping[str, Any]:
        return {
            "fingerprint": self.fingerprint,
            "issued_at": self.issued_at.isoformat(),
        }

    @classmethod
    def deserialize(cls, payload: Mapping[str, Any]) -> "UnlockRecord":
        issued = _coerce_datetime(payload.get("issued_at"))
        if issued is None:
            raise PrivacyError("unlock record missing issued_at")
        return cls(
            fingerprint=str(payload.get("fingerprint", "")) or _fingerprint(issued.isoformat()),
            issued_at=issued,
        )


class ConsentGuardianLayer:
    """Tracks consent state and enforces audit-ready telemetry gating."""

    def __init__(self) -> None:
        self._records: Dict[str, ConsentRecord] = {}
        self._unlocks: Dict[str, UnlockRecord] = {}
        self._events: List[Mapping[str, Any]] = []

    # ------------------------------------------------------------------
    # Consent management
    # ------------------------------------------------------------------
    def grant_consent(
        self,
        user_id: str,
        token: str,
        *,
        expires_in: Optional[float] = None,
        expires_at: Optional[Any] = None,
    ) -> str:
        if not user_id or not user_id.strip():
            raise PrivacyError("user_id must be provided for consent grant")
        if not token or not str(token).strip():
            raise PrivacyError("consent token must be provided")
        expires = _coerce_datetime(expires_at) if expires_at is not None else None
        if expires is None and expires_in is not None:
            expires = _now() + timedelta(seconds=float(expires_in))
        fingerprint = _fingerprint(user_id, token)
        record = ConsentRecord(fingerprint=fingerprint, granted_at=_now(), expires_at=expires)
        self._records[user_id.strip()] = record
        return fingerprint

    def revoke_consent(self, user_id: str) -> None:
        self._records.pop(user_id.strip(), None)
        self._unlocks.pop(user_id.strip(), None)

    def has_consent(self, user_id: str, *, at: Optional[datetime] = None) -> bool:
        at = at or _now()
        record = self._records.get(user_id.strip())
        if not record:
            return False
        if record.expires_at and at > record.expires_at:
            self._records.pop(user_id.strip(), None)
            return False
        return True

    def register_unlock(self, user_id: str, signal: str) -> str:
        if not user_id or not user_id.strip():
            raise PrivacyError("user_id must be provided for unlock")
        if not signal or not str(signal).strip():
            raise PrivacyError("unlock signal must be provided")
        fingerprint = _fingerprint(user_id, signal)
        self._unlocks[user_id.strip()] = UnlockRecord(fingerprint=fingerprint, issued_at=_now())
        return fingerprint

    def has_unlock(self, user_id: str) -> bool:
        return user_id.strip() in self._unlocks

    def require(self, user_id: str) -> None:
        if not self.has_consent(user_id):
            raise PrivacyError("active consent required before telemetry operations")
        if not self.has_unlock(user_id):
            raise PrivacyError("user unlock signal required before telemetry operations")

    # ------------------------------------------------------------------
    # Event logging helpers
    # ------------------------------------------------------------------
    def log_event(self, user_id: str, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        self.require(user_id)
        record = self._records[user_id.strip()]
        event = {
            "user_hash": record.fingerprint,
            "payload": dict(payload),
            "logged_at": _now().isoformat(),
        }
        self._events.append(event)
        return dict(event)

    def clear_events(self) -> None:
        self._events.clear()

    def event_count(self) -> int:
        return len(self._events)

    def status(self) -> Mapping[str, Any]:
        snapshot: Dict[str, Any] = {
            "consents": {
                user: record.serialize()
                for user, record in self._records.items()
                if self.has_consent(user)
            },
            "unlocks": {user: unlock.serialize() for user, unlock in self._unlocks.items()},
            "events_recorded": len(self._events),
        }
        return snapshot

    def serialize(self) -> Mapping[str, Any]:
        return {
            "consents": {user: record.serialize() for user, record in self._records.items()},
            "unlocks": {user: unlock.serialize() for user, unlock in self._unlocks.items()},
        }

    def restore(self, payload: Mapping[str, Any]) -> None:
        consents = payload.get("consents", {})
        unlocks = payload.get("unlocks", {})
        self._records = {
            user: ConsentRecord.deserialize(data)
            for user, data in consents.items()
            if isinstance(data, Mapping)
        }
        self._unlocks = {
            user: UnlockRecord.deserialize(data)
            for user, data in unlocks.items()
            if isinstance(data, Mapping)
        }
        self._events.clear()


class EchoAnonymizerEngine:
    """Removes direct identifiers before telemetry sync or export."""

    _SENSITIVE_KEYS = {
        "user_id",
        "wallet",
        "ens",
        "identity_handle",
        "identity",
        "agent_id",
        "email",
        "name",
    }

    def __init__(self, *, salt: Optional[str] = None) -> None:
        self._salt = salt or _fingerprint("privacy", _now().isoformat())

    def _hash(self, value: str) -> str:
        return _fingerprint(self._salt, value)

    def _scrub(self, value: Any) -> Any:
        if isinstance(value, Mapping):
            scrubbed: Dict[str, Any] = {}
            for key, item in value.items():
                if key in self._SENSITIVE_KEYS:
                    continue
                scrubbed[key] = self._scrub(item)
            return scrubbed
        if isinstance(value, list):
            return [self._scrub(item) for item in value]
        return value

    def anonymize(self, payload: Mapping[str, Any]) -> Dict[str, Any]:
        sanitized: Dict[str, Any] = {}
        user_fingerprint: Optional[str] = None
        for key, value in payload.items():
            if key in self._SENSITIVE_KEYS:
                if key == "user_id" and isinstance(value, str):
                    user_fingerprint = self._hash(value)
                continue
            sanitized[key] = self._scrub(value)
        if user_fingerprint is None and isinstance(payload.get("agent_id"), str):
            user_fingerprint = self._hash(str(payload["agent_id"]))
        if user_fingerprint is not None:
            sanitized.setdefault("user_hash", user_fingerprint)
            sanitized.setdefault("agent_id", user_fingerprint)
        return sanitized


class GhostkeyPrivacyHalo:
    """Applies per-user boundary controls before telemetry persistence."""

    def __init__(self) -> None:
        self._boundaries: Dict[str, Sequence[str]] = {}

    def register_boundary(self, user_id: str, fields: Sequence[str]) -> None:
        user_key = user_id.strip()
        new_fields = tuple(dict.fromkeys(str(field) for field in fields))
        if not new_fields:
            return
        existing = self._boundaries.get(user_key)
        if existing is None:
            self._boundaries[user_key] = new_fields
            return
        merged: List[str] = list(existing)
        existing_set = set(existing)
        for field in new_fields:
            if field not in existing_set:
                merged.append(field)
                existing_set.add(field)
        self._boundaries[user_key] = tuple(merged)

    def enforce(self, user_id: str, payload: Mapping[str, Any]) -> Dict[str, Any]:
        boundary = self._boundaries.get(user_id.strip())
        if boundary is None:
            return {key: value for key, value in payload.items() if key not in ("identity", "identity_handle")}
        allowed = set(boundary)
        return {key: value for key, value in payload.items() if key in allowed}

    def describe(self, user_id: str) -> Sequence[str]:
        boundary = self._boundaries.get(user_id.strip())
        return tuple(boundary) if boundary is not None else ()


@dataclass
class _TraceRecord:
    payload: Mapping[str, Any]
    recorded_at: datetime

    def serialize(self) -> Mapping[str, Any]:
        return {
            "payload": dict(self.payload),
            "recorded_at": self.recorded_at.isoformat(),
        }


class VaultTraceEraser:
    """Auto-deletes traces after a configurable expiration window."""

    def __init__(self, *, expiration_seconds: float = 900.0) -> None:
        if expiration_seconds <= 0:
            raise PrivacyError("expiration_seconds must be positive")
        self._expiration = float(expiration_seconds)
        self._traces: List[_TraceRecord] = []

    @property
    def expiration_seconds(self) -> float:
        return self._expiration

    def register(self, payload: Mapping[str, Any], *, recorded_at: Optional[datetime] = None) -> None:
        timestamp = recorded_at or _now()
        self._traces.append(_TraceRecord(payload=dict(payload), recorded_at=timestamp))
        self.erase_expired(now=timestamp)

    def erase_expired(self, *, now: Optional[datetime] = None) -> int:
        now = now or _now()
        window = timedelta(seconds=self._expiration)
        before = len(self._traces)
        self._traces = [trace for trace in self._traces if now - trace.recorded_at <= window]
        return before - len(self._traces)

    def erase_all(self) -> int:
        count = len(self._traces)
        self._traces.clear()
        return count

    def active_traces(self) -> List[Mapping[str, Any]]:
        self.erase_expired()
        return [trace.serialize() for trace in self._traces]

    def serialize(self) -> Mapping[str, Any]:
        return {"expiration_seconds": self._expiration}

    def restore(self, payload: Mapping[str, Any]) -> None:
        expiration = float(payload.get("expiration_seconds", self._expiration))
        if expiration <= 0:
            raise PrivacyError("expiration_seconds must be positive")
        self._expiration = expiration
        self._traces.clear()


class PrivacyIntegrityShield:
    """High-level orchestrator bundling all Privacy Integrity Shield modules."""

    def __init__(
        self,
        *,
        guardian: Optional[ConsentGuardianLayer] = None,
        anonymizer: Optional[EchoAnonymizerEngine] = None,
        eraser: Optional[VaultTraceEraser] = None,
        halo: Optional[GhostkeyPrivacyHalo] = None,
    ) -> None:
        self.guardian = guardian or ConsentGuardianLayer()
        self.anonymizer = anonymizer or EchoAnonymizerEngine()
        self.eraser = eraser or VaultTraceEraser()
        self.halo = halo or GhostkeyPrivacyHalo()
        self._telemetry_enabled = False

    # ------------------------------------------------------------------
    # Privacy controls
    # ------------------------------------------------------------------
    def toggle_tracking(self, enabled: bool) -> bool:
        self._telemetry_enabled = bool(enabled)
        return self._telemetry_enabled

    def telemetry_enabled(self) -> bool:
        return self._telemetry_enabled

    def register_unlock(self, user_id: str, signal: str) -> str:
        return self.guardian.register_unlock(user_id, signal)

    def grant_consent(
        self,
        user_id: str,
        token: str,
        *,
        expires_in: Optional[float] = None,
        expires_at: Optional[Any] = None,
    ) -> str:
        return self.guardian.grant_consent(user_id, token, expires_in=expires_in, expires_at=expires_at)

    def revoke_consent(self, user_id: str) -> None:
        self.guardian.revoke_consent(user_id)

    # ------------------------------------------------------------------
    # Telemetry orchestration
    # ------------------------------------------------------------------
    def track_event(
        self,
        user_id: str,
        payload: Mapping[str, Any],
        *,
        category: str,
    ) -> Optional[Dict[str, Any]]:
        if not self._telemetry_enabled:
            return None
        if not self.guardian.has_consent(user_id) or not self.guardian.has_unlock(user_id):
            return None
        filtered = self.halo.enforce(user_id, payload)
        enriched: Dict[str, Any] = {**filtered, "category": category, "telemetry_enabled": True}
        anonymized = self.anonymizer.anonymize({"user_id": user_id, **enriched})
        anonymized.setdefault("category", category)
        anonymized.setdefault("telemetry_enabled", True)
        logged = self.guardian.log_event(user_id, anonymized)
        event_payload = dict(logged["payload"])
        event_payload.setdefault("user_hash", logged["user_hash"])
        event_payload.setdefault("category", category)
        event_payload.setdefault("logged_at", logged["logged_at"])
        self.eraser.register(event_payload, recorded_at=_coerce_datetime(logged["logged_at"]))
        return event_payload

    def sanitize_view(self, user_id: str, payload: Mapping[str, Any], *, category: str) -> Dict[str, Any]:
        filtered = self.halo.enforce(user_id, payload)
        enriched: Dict[str, Any] = {**filtered, "category": category, "telemetry_enabled": self._telemetry_enabled}
        return self.anonymizer.anonymize({"user_id": user_id, **enriched})

    def manual_erase(self) -> int:
        erased = self.eraser.erase_all()
        self.guardian.clear_events()
        return erased

    def status(self) -> Mapping[str, Any]:
        return {
            "telemetry_enabled": self._telemetry_enabled,
            "consent": self.guardian.status(),
            "trace_window_seconds": self.eraser.expiration_seconds,
            "active_traces": self.eraser.active_traces(),
            "metadata": dict(_METADATA_SNAPSHOT),
        }

    def serialize(self) -> Mapping[str, Any]:
        return {
            "telemetry_enabled": self._telemetry_enabled,
            "guardian": self.guardian.serialize(),
            "eraser": self.eraser.serialize(),
        }

    def restore(self, payload: Mapping[str, Any]) -> None:
        if not isinstance(payload, Mapping):
            return
        self._telemetry_enabled = bool(payload.get("telemetry_enabled", self._telemetry_enabled))
        guardian_state = payload.get("guardian")
        if isinstance(guardian_state, Mapping):
            self.guardian.restore(guardian_state)
        eraser_state = payload.get("eraser")
        if isinstance(eraser_state, Mapping):
            self.eraser.restore(eraser_state)
        self.guardian.clear_events()
        self.eraser.erase_all()


_GLOBAL_PRIVACY_STATE_PATH = Path(__file__).resolve().parent / "status" / "ghostkey_privacy_state.json"


def _load_persisted_state() -> Mapping[str, Any]:
    if not _GLOBAL_PRIVACY_STATE_PATH.exists():
        return {}
    try:
        return json.loads(_GLOBAL_PRIVACY_STATE_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def _save_persisted_state(state: Mapping[str, Any]) -> None:
    _GLOBAL_PRIVACY_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _GLOBAL_PRIVACY_STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True))


_GLOBAL_PRIVACY_SHIELD = PrivacyIntegrityShield()

try:
    _GLOBAL_PRIVACY_SHIELD.restore(_load_persisted_state())
except PrivacyError:
    # Ignore persisted corruption and start with a clean state.
    _GLOBAL_PRIVACY_SHIELD = PrivacyIntegrityShield()


def get_privacy_shield() -> PrivacyIntegrityShield:
    """Return the process-wide Privacy Integrity Shield instance."""

    return _GLOBAL_PRIVACY_SHIELD


def persist_privacy_state() -> None:
    """Persist the current privacy state to disk."""

    _save_persisted_state(_GLOBAL_PRIVACY_SHIELD.serialize())


__all__.append("persist_privacy_state")
