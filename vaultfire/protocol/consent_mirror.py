"""Consent mirroring API for partner integrations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, MutableMapping

from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID


@dataclass(slots=True)
class ConsentRecord:
    partner_id: str
    scope: str
    manifest: Mapping[str, object]


class ConsentMirror:
    """Allows partners to mirror the Vaultfire belief structure under consent."""

    def __init__(self, *, public_manifest: Mapping[str, object], usage_scope: str) -> None:
        self.public_manifest = dict(public_manifest)
        self.usage_scope = usage_scope
        self.architect_wallet = ARCHITECT_WALLET
        self.origin_node = ORIGIN_NODE_ID
        self._partners: MutableMapping[str, ConsentRecord] = {}

    def register_partner(self, partner_id: str, *, consent_hash: str) -> ConsentRecord:
        if not partner_id:
            raise ValueError("partner_id required")
        record = ConsentRecord(
            partner_id=partner_id,
            scope=self.usage_scope,
            manifest={
                **self.public_manifest,
                "consent_hash": consent_hash,
                "architect_wallet": self.architect_wallet,
                "origin_node": self.origin_node,
            },
        )
        self._partners[partner_id] = record
        return record

    def mirror_beliefs(self, partner_id: str, *, signal: Mapping[str, object]) -> Dict[str, object]:
        record = self._partners.get(partner_id)
        if not record:
            raise PermissionError("partner not registered for consent mirroring")
        return {
            "partner_id": partner_id,
            "scope": record.scope,
            "signal": dict(signal),
            "architect_wallet": self.architect_wallet,
            "origin_node": self.origin_node,
        }


__all__ = ["ConsentMirror", "ConsentRecord"]
