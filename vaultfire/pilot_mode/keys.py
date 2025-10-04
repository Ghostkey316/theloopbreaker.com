"""Protocol key management for pilot mode sessions."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, MutableMapping, Optional

from . import storage

__all__ = ["ProtocolKey", "ProtocolKeyManager"]


@dataclass
class ProtocolKey:
    """Represents a limited-access protocol key."""

    token_hash: str
    partner_id: str
    partner_tag: str
    expires_at: datetime
    max_uses: Optional[int]
    usage_count: int = 0
    watermark_enabled: bool = False
    metadata: MutableMapping[str, object] = field(default_factory=dict)

    def is_expired(self, *, reference_time: Optional[datetime] = None) -> bool:
        reference_time = reference_time or datetime.now(timezone.utc)
        return reference_time >= self.expires_at

    def has_remaining_uses(self) -> bool:
        if self.max_uses is None:
            return True
        return self.usage_count < self.max_uses

    def record_use(self) -> None:
        self.usage_count += 1


class ProtocolKeyManager:
    """Persistent manager for issuing and validating protocol keys."""

    def __init__(self, *, path=None) -> None:
        self._path = path or storage.PROTOCOL_KEYS_PATH
        self._records: List[Dict[str, object]] = storage.read_json(self._path, [])

    @staticmethod
    def _hash_token(token: str) -> str:
        if not token or not token.strip():
            raise ValueError("token must be provided")
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _serialize(key: ProtocolKey) -> Dict[str, object]:
        payload = {
            "token_hash": key.token_hash,
            "partner_id": key.partner_id,
            "partner_tag": key.partner_tag,
            "expires_at": key.expires_at.isoformat(),
            "usage_count": key.usage_count,
            "watermark_enabled": key.watermark_enabled,
        }
        if key.max_uses is not None:
            payload["max_uses"] = key.max_uses
        if key.metadata:
            payload["metadata"] = dict(key.metadata)
        return payload

    @staticmethod
    def _deserialize(payload: Dict[str, object]) -> ProtocolKey:
        expires_at = datetime.fromisoformat(str(payload["expires_at"])).astimezone(timezone.utc)
        return ProtocolKey(
            token_hash=str(payload["token_hash"]),
            partner_id=str(payload["partner_id"]),
            partner_tag=str(payload["partner_tag"]),
            expires_at=expires_at,
            max_uses=payload.get("max_uses"),
            usage_count=int(payload.get("usage_count", 0)),
            watermark_enabled=bool(payload.get("watermark_enabled", False)),
            metadata=dict(payload.get("metadata", {})),
        )

    def _flush(self) -> None:
        storage.write_json(self._path, self._records)

    def _iter_keys(self) -> Iterable[ProtocolKey]:
        for record in list(self._records):
            try:
                yield self._deserialize(record)
            except (KeyError, ValueError):
                continue

    def _replace_record(self, key: ProtocolKey) -> None:
        for index, record in enumerate(self._records):
            if record.get("token_hash") == key.token_hash:
                self._records[index] = self._serialize(key)
                break
        else:
            self._records.append(self._serialize(key))
        self._flush()

    def issue_key(
        self,
        *,
        partner_id: str,
        partner_tag: str,
        expires_in_days: int = 30,
        max_uses: Optional[int] = 1,
        watermark_enabled: bool = False,
        metadata: Optional[MutableMapping[str, object]] = None,
    ) -> str:
        if expires_in_days <= 0:
            raise ValueError("expires_in_days must be positive")
        token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(token)
        expiry = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        record = ProtocolKey(
            token_hash=token_hash,
            partner_id=partner_id,
            partner_tag=partner_tag,
            expires_at=expiry,
            max_uses=max_uses,
            usage_count=0,
            watermark_enabled=watermark_enabled,
            metadata=dict(metadata or {}),
        )
        self._records.append(self._serialize(record))
        self._flush()
        return token

    def prune_expired(self) -> None:
        now = datetime.now(timezone.utc)
        filtered: List[Dict[str, object]] = []
        for record in self._records:
            try:
                expires_at = datetime.fromisoformat(str(record["expires_at"])).astimezone(timezone.utc)
            except (KeyError, ValueError):
                continue
            if now < expires_at:
                filtered.append(record)
        if len(filtered) != len(self._records):
            self._records = filtered
            self._flush()

    def consume(self, token: str, *, partner_id: str) -> ProtocolKey:
        token_hash = self._hash_token(token)
        refreshed: List[Dict[str, object]] = []
        selected: Optional[ProtocolKey] = None
        for record in self._records:
            if record.get("token_hash") != token_hash:
                refreshed.append(record)
                continue
            key = self._deserialize(record)
            if key.partner_id != partner_id:
                raise PermissionError("protocol key does not belong to partner")
            if key.is_expired():
                raise PermissionError("protocol key has expired")
            if not key.has_remaining_uses():
                raise PermissionError("protocol key has no remaining uses")
            key.record_use()
            selected = key
            refreshed.append(self._serialize(key))
        if selected is None:
            raise PermissionError("protocol key is invalid")
        self._records = refreshed
        self._flush()
        return selected
