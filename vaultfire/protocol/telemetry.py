"""Telemetry helpers for orchestrating trace streams."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping
from uuid import uuid4

from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID
from vaultfire.security.fhe import FHECipherSuite

_REPO_ROOT = Path(__file__).resolve().parents[2]
_TRACE_STREAM_PATH = _REPO_ROOT / "telemetry" / "trace_stream.log"


def activate_trace_stream(wallet_id: str, *, simulation_mode: bool = False) -> Dict[str, Any]:
    """Record activation of a telemetry trace stream for ``wallet_id``.

    The function appends a JSON line to ``telemetry/trace_stream.log`` containing
    the wallet, trace identifier, and execution metadata so downstream tools can
    subscribe to the synthetic stream during simulations.
    """

    if not wallet_id or not wallet_id.strip():
        raise ValueError("wallet_id must be a non-empty string")

    event = {
        "trace_id": uuid4().hex,
        "wallet_id": wallet_id.strip(),
        "mode": "simulation" if simulation_mode else "live",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    _TRACE_STREAM_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _TRACE_STREAM_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event) + "\n")

    return event


class ZKFog:
    """AI secure telemetry summarizer that emits ZK friendly proofs."""

    def __init__(
        self,
        *,
        behavior_input: Iterable[Mapping[str, Any]],
        output_proof: str,
        cipher_suite: FHECipherSuite | None = None,
    ) -> None:
        self._entries = tuple(dict(item) for item in behavior_input)
        self._output_proof = output_proof
        self._cipher_suite = cipher_suite or FHECipherSuite()
        self.architect_wallet = ARCHITECT_WALLET
        self.origin_node = ORIGIN_NODE_ID

    def synthesize_summary(self) -> Dict[str, Any]:
        """Create an encrypted telemetry digest and zk commitment."""

        if not self._entries:
            raise ValueError("behavior_input is required")
        aggregate = self._cipher_suite.encrypt_record(
            {
                "events": len(self._entries),
                "ethical_flags": [entry.get("ethics") for entry in self._entries],
                "proof_target": self._output_proof,
            },
            sensitive_fields=("ethical_flags",),
        )
        proof = self._cipher_suite.generate_zero_knowledge_commitment(
            aggregate,
            context=f"telemetry::{self._output_proof}",
        )
        return {
            "ciphertext": aggregate,
            "proof": proof,
            "events": len(self._entries),
            "architect_wallet": self.architect_wallet,
            "origin_node": self.origin_node,
        }


__all__ = ["activate_trace_stream", "ZKFog"]
