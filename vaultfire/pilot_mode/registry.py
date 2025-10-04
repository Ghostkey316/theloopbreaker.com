"""Partner registry for the Vaultfire pilot access layer."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Iterable, List, MutableMapping, Optional

from . import storage

__all__ = ["PartnerRecord", "PilotAccessRegistry"]


def _hash_value(value: str) -> str:
    if not value or not value.strip():
        raise ValueError("value must be provided")
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _normalize_wallet(wallet: str) -> str:
    if not wallet or not wallet.strip():
        raise ValueError("wallet must be provided")
    return wallet.strip().lower()


def _generate_anonymized_tag(index: int) -> str:
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    prefix = index % len(alphabet)
    suffix = index // len(alphabet)
    if suffix:
        return f"Partner-{alphabet[prefix]}{suffix}"
    return f"Partner-{alphabet[prefix]}"


@dataclass
class PartnerRecord:
    """Partner registration details."""

    partner_id: str
    anonymized_tag: str
    hashed_api_keys: List[str] = field(default_factory=list)
    wallet_addresses: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    default_watermark: bool = False
    signature_secret: str = field(default_factory=lambda: secrets.token_hex(16))
    allow_identity_disclosure: bool = False
    metadata: MutableMapping[str, object] = field(default_factory=dict)

    def to_payload(self) -> Dict[str, object]:
        payload: Dict[str, object] = {
            "partner_id": self.partner_id,
            "anonymized_tag": self.anonymized_tag,
            "hashed_api_keys": list(self.hashed_api_keys),
            "wallet_addresses": list(self.wallet_addresses),
            "created_at": self.created_at.isoformat(),
            "default_watermark": self.default_watermark,
            "signature_secret": self.signature_secret,
            "allow_identity_disclosure": self.allow_identity_disclosure,
        }
        if self.metadata:
            payload["metadata"] = dict(self.metadata)
        return payload

    @classmethod
    def from_payload(cls, payload: Dict[str, object]) -> "PartnerRecord":
        created_at = datetime.fromisoformat(str(payload["created_at"])).astimezone(timezone.utc)
        return cls(
            partner_id=str(payload["partner_id"]),
            anonymized_tag=str(payload["anonymized_tag"]),
            hashed_api_keys=list(payload.get("hashed_api_keys", [])),
            wallet_addresses=list(payload.get("wallet_addresses", [])),
            created_at=created_at,
            default_watermark=bool(payload.get("default_watermark", False)),
            signature_secret=str(payload.get("signature_secret", secrets.token_hex(16))),
            allow_identity_disclosure=bool(payload.get("allow_identity_disclosure", False)),
            metadata=dict(payload.get("metadata", {})),
        )


class PilotAccessRegistry:
    """Registry that manages verified partner credentials."""

    def __init__(self, *, path=None) -> None:
        self._path = path or storage.PARTNER_REGISTRY_PATH
        raw_records = storage.read_json(self._path, [])
        self._records: Dict[str, PartnerRecord] = {}
        for raw in raw_records:
            try:
                record = PartnerRecord.from_payload(raw)
            except (KeyError, ValueError):
                continue
            self._records[record.partner_id] = record

    def _next_anonymized_tag(self) -> str:
        existing = sorted(record.anonymized_tag for record in self._records.values())
        index = 0
        while True:
            tag = _generate_anonymized_tag(index)
            if tag not in existing:
                return tag
            index += 1

    def _persist(self) -> None:
        payload = [record.to_payload() for record in self._records.values()]
        storage.write_json(self._path, payload)

    def register_partner(
        self,
        partner_id: str,
        *,
        api_keys: Optional[Iterable[str]] = None,
        wallet_addresses: Optional[Iterable[str]] = None,
        default_watermark: bool = False,
        allow_identity_disclosure: bool = False,
        metadata: Optional[MutableMapping[str, object]] = None,
    ) -> PartnerRecord:
        if not partner_id or not partner_id.strip():
            raise ValueError("partner_id must be provided")
        partner_id = partner_id.strip()
        record = self._records.get(partner_id)
        if record is None:
            record = PartnerRecord(
                partner_id=partner_id,
                anonymized_tag=self._next_anonymized_tag(),
                default_watermark=default_watermark,
                allow_identity_disclosure=allow_identity_disclosure,
                metadata=dict(metadata or {}),
            )
        if api_keys:
            record.hashed_api_keys = sorted({_hash_value(key) for key in api_keys})
        if wallet_addresses:
            record.wallet_addresses = sorted({_normalize_wallet(wallet) for wallet in wallet_addresses})
        if metadata:
            record.metadata.update(metadata)
        record.default_watermark = default_watermark
        record.allow_identity_disclosure = allow_identity_disclosure
        self._records[partner_id] = record
        self._persist()
        return record

    def get_record(self, partner_id: str) -> PartnerRecord:
        if partner_id not in self._records:
            raise PermissionError("partner is not registered")
        return self._records[partner_id]

    def validate_api_key(self, partner_id: str, api_key: str) -> PartnerRecord:
        record = self.get_record(partner_id)
        hashed = _hash_value(api_key)
        if hashed not in record.hashed_api_keys:
            raise PermissionError("invalid api key")
        return record

    def validate_wallet_signature(
        self,
        partner_id: str,
        *,
        wallet_address: str,
        signature: str,
        message: str = "vaultfire-pilot-access",
    ) -> PartnerRecord:
        record = self.get_record(partner_id)
        normalized_wallet = _normalize_wallet(wallet_address)
        if normalized_wallet not in record.wallet_addresses:
            raise PermissionError("wallet is not authorized for pilot access")
        expected = hmac.new(
            key=record.signature_secret.encode("utf-8"),
            msg=f"{normalized_wallet}:{message}".encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()
        if not secrets.compare_digest(expected, signature):
            raise PermissionError("wallet signature is invalid")
        return record

    def get_anonymized_tag(self, partner_id: str) -> str:
        return self.get_record(partner_id).anonymized_tag

    def list_records(self) -> List[PartnerRecord]:
        return list(self._records.values())

    def revoke_api_keys(self, partner_id: str) -> None:
        record = self.get_record(partner_id)
        record.hashed_api_keys = []
        self._persist()

    def revoke_wallets(self, partner_id: str) -> None:
        record = self.get_record(partner_id)
        record.wallet_addresses = []
        self._persist()

    def issue_signature_secret(self, partner_id: str) -> str:
        record = self.get_record(partner_id)
        record.signature_secret = secrets.token_hex(16)
        self._persist()
        return record.signature_secret
