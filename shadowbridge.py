"""ShadowBridge connective tissue between NS3 overlays and Vaultfire."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List


@dataclass
class BridgeEvent:
    """Represents a synchronized payload event."""

    source: str
    destination: str
    payload_digest: str
    timestamp: datetime


class ShadowBridge:
    """Synchronizes NS3 mobility overlays with Vaultfire Ghostshroud."""

    def __init__(self, *, override_targets: List[str] | None = None) -> None:
        self.override_targets = override_targets or ["bpow20.cb.id", "ghostkey316.eth"]
        self._events: List[BridgeEvent] = []
        self._biometric_masks: Dict[str, str] = {}

    def sync_layers(self, payload: bytes, *, source: str = "ns3", destination: str = "vaultfire") -> BridgeEvent:
        """Record a synchronized payload event across layers."""

        digest = hex(sum(payload) % (1 << 32))[2:].zfill(8)
        event = BridgeEvent(
            source=source,
            destination=destination,
            payload_digest=digest,
            timestamp=datetime.utcnow(),
        )
        self._events.append(event)
        return event

    def mask_biometric(self, biometric_hash: str, *, strategy: str = "obfuscate") -> str:
        """Apply a biometric masking strategy for future WLD/WorldID nodes."""

        masked = f"{strategy}:{biometric_hash[::-1]}"
        self._biometric_masks[biometric_hash] = masked
        return masked

    def route_override(self, target: str) -> str:
        """Return the ethereal override routing for a target identity."""

        if target not in self.override_targets:
            self.override_targets.append(target)
        index = self.override_targets.index(target)
        return f"shadowbridge://override/{target}/{index:02d}"

    @property
    def events(self) -> List[BridgeEvent]:
        """Expose recorded bridge events."""

        return list(self._events)

    @property
    def biometric_masks(self) -> Dict[str, str]:
        """Expose masked biometric references."""

        return dict(self._biometric_masks)
