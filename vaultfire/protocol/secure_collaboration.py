"""MPC + FHE orchestration utilities for Vaultfire."""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from typing import Dict, Iterable, Mapping, MutableMapping, Sequence

from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID
from vaultfire.security.fhe import Ciphertext, FHECipherSuite


@dataclass(slots=True)
class MPCContribution:
    """Container describing an encrypted MPC contribution."""

    wallet: str
    ciphertext: Ciphertext
    context: str
    blueprint_id: str | None = None
    compliance_scope: Mapping[str, str] | None = None


class MPCFabric:
    """Prototype multi-party coordination fabric using FHE."""

    def __init__(self, *, cipher_suite: FHECipherSuite) -> None:
        self._cipher_suite = cipher_suite
        self._contributions: MutableMapping[str, MPCContribution] = {}
        self._integration_manifests: MutableMapping[str, Dict[str, object]] = {}
        self.architect_wallet = ARCHITECT_WALLET
        self.origin_node = ORIGIN_NODE_ID

    @property
    def participants(self) -> Iterable[str]:
        return tuple(self._contributions.keys())

    @property
    def integration_manifests(self) -> Sequence[Dict[str, object]]:
        return tuple(self._integration_manifests.values())

    def autoconfigure(
        self,
        partner_id: str,
        *,
        required_fields: Iterable[str] | None = None,
        compliance_tags: Mapping[str, str] | None = None,
    ) -> Dict[str, object]:
        if not partner_id or not partner_id.strip():
            raise ValueError("partner_id is required")
        required_fields = tuple(sorted(dict.fromkeys(required_fields or ())))
        compliance_tags = dict(compliance_tags or {})
        timestamp = time.time()
        seed = {
            "partner_id": partner_id,
            "required_fields": required_fields,
            "compliance_tags": compliance_tags,
            "timestamp": timestamp,
        }
        blueprint_hash = hashlib.blake2b(
            json.dumps(seed, sort_keys=True).encode("utf-8"), digest_size=16
        ).hexdigest()
        blueprint = {
            "partner_id": partner_id,
            "required_fields": required_fields,
            "compliance_tags": compliance_tags,
            "blueprint_hash": blueprint_hash,
            "generated_at": timestamp,
        }
        self._integration_manifests[partner_id] = blueprint
        return blueprint

    def submit_encrypted_payload(
        self,
        wallet: str,
        payload: Mapping[str, object],
        *,
        signal_context: str,
        partner_id: str | None = None,
    ) -> MPCContribution:
        """Encrypt a participant payload and register it for MPC aggregation."""

        if not wallet or not wallet.strip():
            raise ValueError("wallet must be provided")
        if not signal_context:
            raise ValueError("signal_context is required")

        blueprint_id: str | None = None
        compliance_scope: Mapping[str, str] | None = None
        if partner_id is not None:
            blueprint = self._integration_manifests.get(partner_id)
            if blueprint is None:
                raise KeyError(f"integration blueprint missing for partner '{partner_id}'")
            missing = [field for field in blueprint["required_fields"] if field not in payload]
            if missing:
                raise ValueError(f"payload missing required fields: {missing}")
            blueprint_id = str(blueprint["blueprint_hash"])
            compliance_scope = dict(blueprint["compliance_tags"])

        ciphertext = self._cipher_suite.encrypt_record(
            dict(payload),
            sensitive_fields=tuple(payload.keys()),
        )
        contribution = MPCContribution(
            wallet=wallet,
            ciphertext=ciphertext,
            context=signal_context,
            blueprint_id=blueprint_id,
            compliance_scope=compliance_scope,
        )
        self._contributions[wallet] = contribution
        return contribution

    def collaborative_sum(self) -> Dict[str, object]:
        """Combine contributions into a single ciphertext and generate a proof."""

        if not self._contributions:
            raise ValueError("no contributions registered")
        ciphertexts = [item.ciphertext for item in self._contributions.values()]
        aggregate = self._cipher_suite.homomorphic_add(*ciphertexts)
        proof = self._cipher_suite.generate_zero_knowledge_commitment(
            aggregate,
            context="vaultfire::mpc_collaboration",
        )
        blueprint_ids = sorted(
            {item.blueprint_id for item in self._contributions.values() if item.blueprint_id}
        )
        return {
            "ciphertext": aggregate,
            "proof": proof,
            "participants": len(ciphertexts),
            "architect_wallet": self.architect_wallet,
            "origin_node": self.origin_node,
            "blueprint_ids": blueprint_ids,
        }

    def decrypt_summary(self) -> Dict[str, object]:
        """Produce a decrypted summary for compliance scoped review."""

        aggregate = self.collaborative_sum()["ciphertext"]
        value = self._cipher_suite.decrypt_record(aggregate)
        compliance_scopes = [
            contribution.compliance_scope
            for contribution in self._contributions.values()
            if contribution.compliance_scope
        ]
        return {
            "approximate_value": value["approximate_value"],
            "moral_tag": value["moral_tag"],
            "participants": len(self._contributions),
            "compliance_scopes": compliance_scopes,
        }


__all__ = ["MPCContribution", "MPCFabric"]
