"""Privacy and encryption utilities for Vaultfire pilot mode."""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Mapping, MutableMapping, Optional

from utils.crypto import derive_key, encrypt_text

from . import storage

__all__ = ["PilotReference", "PilotPrivacyLedger"]


_DEFAULT_SECRET = "vaultfire-pilot-secret"


def _serialize_json(value: object) -> object:
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"Unsupported type for serialization: {type(value)!r}")


@dataclass
class PilotReference:
    """An anonymized, encrypted pilot record."""

    reference_id: str
    reference_type: str
    partner_tag: str
    generated_at: datetime
    payload_token: str
    metadata: MutableMapping[str, object] = field(default_factory=dict)

    def export(self) -> Dict[str, object]:
        payload: Dict[str, object] = {
            "reference_id": self.reference_id,
            "reference_type": self.reference_type,
            "partner_tag": self.partner_tag,
            "generated_at": self.generated_at.isoformat(),
            "payload_token": self.payload_token,
            "metadata": dict(self.metadata),
        }
        return payload


class PilotPrivacyLedger:
    """Encrypts and persists anonymized pilot references."""

    def __init__(
        self,
        *,
        secret: Optional[str] = None,
        reference_log_path=None,
    ) -> None:
        self._secret = secret or os.environ.get("VAULTFIRE_PILOT_SECRET") or _DEFAULT_SECRET
        self._key = derive_key(self._secret)
        self._reference_log_path = reference_log_path or storage.PRIVATE_REFERENCE_LOG_PATH

    def attach_path(self, path) -> None:
        self._reference_log_path = path

    def record_reference(
        self,
        *,
        partner_tag: str,
        reference_type: str,
        payload: Mapping[str, object],
        metadata: Optional[Mapping[str, object]] = None,
    ) -> PilotReference:
        if not partner_tag or not partner_tag.strip():
            raise ValueError("partner_tag must be provided")
        if not reference_type or not reference_type.strip():
            raise ValueError("reference_type must be provided")
        serialized = json.dumps(payload, sort_keys=True, default=_serialize_json)
        token = encrypt_text(self._key, serialized)
        reference = PilotReference(
            reference_id=uuid.uuid4().hex,
            reference_type=reference_type.strip(),
            partner_tag=partner_tag,
            generated_at=datetime.now(timezone.utc),
            payload_token=token,
            metadata=dict(metadata or {}),
        )
        storage.append_jsonl(self._reference_log_path, reference.export())
        return reference
