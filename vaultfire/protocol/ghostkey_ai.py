"""Ghostkey AI companion node helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, MutableMapping

from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID


@dataclass(slots=True)
class GhostkeyAINode:
    wallet: str
    function: str
    status: str
    telemetry: Mapping[str, object]


class GhostkeyAINetwork:
    """Passive AI ethics agent registry."""

    def __init__(self) -> None:
        self._nodes: MutableMapping[str, GhostkeyAINode] = {}
        self.architect_wallet = ARCHITECT_WALLET
        self.origin_node = ORIGIN_NODE_ID

    def deploy(self, *, wallet: str, function: str, telemetry: Mapping[str, object] | None = None) -> GhostkeyAINode:
        node = GhostkeyAINode(
            wallet=wallet,
            function=function,
            status="passive",
            telemetry=dict(telemetry or {}),
        )
        self._nodes[wallet] = node
        return node

    def trigger_ethics_boost(self, wallet: str, *, ethics_score: float) -> Dict[str, object]:
        node = self._nodes.get(wallet)
        if not node:
            raise KeyError("ghostkey ai node not deployed")
        event = {
            "wallet": wallet,
            "ethics_score": ethics_score,
            "status": "boosted" if ethics_score >= 0.8 else "observing",
            "architect_wallet": self.architect_wallet,
            "origin_node": self.origin_node,
        }
        node.telemetry = {**dict(node.telemetry), **event}
        node.status = event["status"]
        return event

    def get_node(self, wallet: str) -> GhostkeyAINode | None:
        return self._nodes.get(wallet)


__all__ = ["GhostkeyAINode", "GhostkeyAINetwork"]
