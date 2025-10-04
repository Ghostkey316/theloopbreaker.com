"""Pilot access layer orchestrating registry, keys, and sessions."""

from __future__ import annotations

from typing import Iterable, MutableMapping, Optional

from .feedback import FeedbackCollector
from .keys import ProtocolKeyManager
from .registry import PilotAccessRegistry, PartnerRecord
from .sandbox import YieldSandbox
from .session import PilotSession, SessionFactory

__all__ = ["PilotAccessLayer"]


class PilotAccessLayer:
    """High-level API for secure pilot mode activation."""

    def __init__(
        self,
        *,
        registry: Optional[PilotAccessRegistry] = None,
        key_manager: Optional[ProtocolKeyManager] = None,
        sandbox: Optional[YieldSandbox] = None,
        feedback: Optional[FeedbackCollector] = None,
    ) -> None:
        self._registry = registry or PilotAccessRegistry()
        self._keys = key_manager or ProtocolKeyManager()
        self._session_factory = SessionFactory(sandbox=sandbox, feedback=feedback)

    @property
    def registry(self) -> PilotAccessRegistry:
        return self._registry

    @property
    def key_manager(self) -> ProtocolKeyManager:
        return self._keys

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
        return self._registry.register_partner(
            partner_id,
            api_keys=api_keys,
            wallet_addresses=wallet_addresses,
            default_watermark=default_watermark,
            allow_identity_disclosure=allow_identity_disclosure,
            metadata=metadata,
        )

    def issue_protocol_key(
        self,
        partner_id: str,
        *,
        expires_in_days: int = 30,
        max_uses: Optional[int] = 1,
        watermark_enabled: Optional[bool] = None,
        metadata: Optional[MutableMapping[str, object]] = None,
    ) -> str:
        partner = self._registry.get_record(partner_id)
        watermark = watermark_enabled if watermark_enabled is not None else partner.default_watermark
        return self._keys.issue_key(
            partner_id=partner.partner_id,
            partner_tag=partner.anonymized_tag,
            expires_in_days=expires_in_days,
            max_uses=max_uses,
            watermark_enabled=watermark,
            metadata=metadata,
        )

    def activate_session(
        self,
        partner_id: str,
        *,
        protocol_key: str,
        api_key: Optional[str] = None,
        wallet_address: Optional[str] = None,
        wallet_signature: Optional[str] = None,
        signature_message: str = "vaultfire-pilot-access",
        watermark_override: Optional[bool] = None,
    ) -> PilotSession:
        if not protocol_key or not protocol_key.strip():
            raise ValueError("protocol_key must be provided")
        partner: Optional[PartnerRecord] = None
        key_record = self._keys.consume(protocol_key, partner_id=partner_id)
        if api_key:
            partner = self._registry.validate_api_key(partner_id, api_key)
        elif wallet_address and wallet_signature:
            partner = self._registry.validate_wallet_signature(
                partner_id,
                wallet_address=wallet_address,
                signature=wallet_signature,
                message=signature_message,
            )
        else:
            raise PermissionError("pilot access requires api key or wallet signature")
        session = self._session_factory.create(
            partner=partner,
            protocol_key=key_record,
            watermark_override=watermark_override,
        )
        return session

    def refresh_signature_secret(self, partner_id: str) -> str:
        return self._registry.issue_signature_secret(partner_id)

    def prune_expired_keys(self) -> None:
        self._keys.prune_expired()
