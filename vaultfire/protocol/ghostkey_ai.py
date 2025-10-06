"""Ghostkey AI network primitives with mission ledger durability."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Dict, Mapping, MutableMapping, Optional, Sequence

from vaultfire.mission import LedgerMetadata, MissionLedger
from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID


@dataclass(slots=True)
class GhostkeyAINode:
    wallet: str
    function: str
    status: str
    telemetry: Mapping[str, object]
    region: str
    ledger_reference: str


class GhostkeyAINetwork:
    """Durable AI ethics network backed by the mission ledger."""

    def __init__(
        self,
        *,
        ledger: MissionLedger | None = None,
        regions: Sequence[str] | None = None,
    ) -> None:
        self._ledger = ledger or MissionLedger.default(component="ghostkey-ai")
        self._nodes: MutableMapping[str, GhostkeyAINode] = {}
        self.architect_wallet = ARCHITECT_WALLET
        self.origin_node = ORIGIN_NODE_ID
        self._regions = tuple(regions or ("global",))
        self._rehydrate_from_ledger()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _rehydrate_from_ledger(self) -> None:
        for record in self._ledger.iter(category="ai.node"):
            payload = record.payload
            wallet = str(payload.get("wallet"))
            if not wallet:
                continue
            node = GhostkeyAINode(
                wallet=wallet,
                function=str(payload.get("function", "")),
                status=str(payload.get("status", "passive")),
                telemetry=dict(payload.get("telemetry", {})),
                region=str(payload.get("region", record.metadata.region)),
                ledger_reference=record.record_id,
            )
            self._nodes[wallet] = node

    def _append_node(self, node_payload: Mapping[str, object], metadata: LedgerMetadata) -> GhostkeyAINode:
        record = self._ledger.append("ai.node", node_payload, metadata)
        node = GhostkeyAINode(
            wallet=str(node_payload["wallet"]),
            function=str(node_payload["function"]),
            status=str(node_payload.get("status", "passive")),
            telemetry=dict(node_payload.get("telemetry", {})),
            region=metadata.region,
            ledger_reference=record.record_id,
        )
        self._nodes[node.wallet] = node
        return node

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def register_region(self, region: str) -> None:
        if region not in self._regions:
            self._regions = (*self._regions, region)

    def deploy(
        self,
        *,
        wallet: str,
        function: str,
        telemetry: Mapping[str, object] | None = None,
        partner_id: Optional[str] = None,
        region: str = "global",
        diligence_artifacts: Sequence[str] | None = None,
    ) -> GhostkeyAINode:
        telemetry_payload = {
            **dict(telemetry or {}),
            "integrity_state": "initialized",
            "origin_node": self.origin_node,
        }
        metadata = self._ledger.metadata_template(
            partner_id=partner_id,
            narrative=f"Deploy AI node for {wallet}",
            diligence_artifacts=tuple(diligence_artifacts or ()),
            region=region,
            tags=("ai-node", "deployment"),
        )
        node_payload = {
            "wallet": wallet,
            "function": function,
            "status": "passive",
            "telemetry": telemetry_payload,
            "region": region,
            "architect_wallet": self.architect_wallet,
        }
        node = self._append_node(node_payload, metadata)
        self.register_region(region)
        return node

    def trigger_ethics_boost(self, wallet: str, *, ethics_score: float) -> Dict[str, object]:
        node = self._nodes.get(wallet)
        if not node:
            raise KeyError("ghostkey ai node not deployed")
        status = "boosted" if ethics_score >= 0.8 else "observing"
        event = {
            "wallet": wallet,
            "ethics_score": ethics_score,
            "status": status,
            "architect_wallet": self.architect_wallet,
            "origin_node": self.origin_node,
            "region": node.region,
            "ledger_reference": node.ledger_reference,
        }
        metadata = self._ledger.metadata_template(
            partner_id=wallet,
            narrative="Ethics boost diagnostic",
            diligence_artifacts=(f"ledger://{node.ledger_reference}",),
            region=node.region,
            tags=("ai-node", "ethics"),
        )
        self._ledger.append("ai.event", event, metadata)
        updated_node = replace(
            node,
            status=status,
            telemetry={**dict(node.telemetry), **event},
        )
        self._nodes[wallet] = updated_node
        return event

    def get_node(self, wallet: str) -> Optional[GhostkeyAINode]:
        return self._nodes.get(wallet)

    def integrity_snapshot(self) -> Sequence[Dict[str, object]]:
        snapshot = []
        for node in self._nodes.values():
            record = self._ledger.lookup(node.ledger_reference)
            snapshot.append(
                {
                    "wallet": node.wallet,
                    "status": node.status,
                    "region": node.region,
                    "ledger_verified": record is not None,
                    "telemetry_checksum": hash(tuple(sorted(node.telemetry.items()))),
                }
            )
        return snapshot

    def failover_diagnostics(self) -> Sequence[Dict[str, object]]:
        diagnostics = []
        for region in self._regions:
            nodes = [node for node in self._nodes.values() if node.region == region]
            if not nodes:
                status = "degraded"
            elif any(node.status == "boosted" for node in nodes):
                status = "active"
            else:
                status = "standby"
            diagnostics.append(
                {
                    "region": region,
                    "status": status,
                    "nodes": [node.wallet for node in nodes],
                }
            )
        return diagnostics


__all__ = ["GhostkeyAINode", "GhostkeyAINetwork"]
