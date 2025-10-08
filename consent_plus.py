"""Consent+ mode upgrades supporting ShadowFrost operations."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List


@dataclass
class RevocationBeacon:
    """Represents a stealth revocation beacon emission."""

    consent_id: str
    issued_at: datetime
    reason: str


@dataclass
class KillSwitchEvent:
    """Represents a silent kill-switch activation."""

    channel: str
    initiated_by: str
    issued_at: datetime
    route: str


class ConsentPlusMode:
    """Implements Consent+ enhancements with live override telemetry."""

    def __init__(self, *, operator: str = "Ghostkey-316") -> None:
        self.operator = operator
        self._revocations: List[RevocationBeacon] = []
        self._kill_switches: List[KillSwitchEvent] = []
        self._dashboard_state: Dict[str, str] = {}

    def emit_revocation_beacon(self, consent_id: str, *, reason: str) -> RevocationBeacon:
        """Emit a stealth revocation beacon."""

        beacon = RevocationBeacon(
            consent_id=consent_id,
            issued_at=datetime.utcnow(),
            reason=reason,
        )
        self._revocations.append(beacon)
        self._dashboard_state[f"beacon:{consent_id}"] = reason
        return beacon

    def trigger_kill_switch(self, channel: str, *, route_hint: str = "ghostkey316.eth") -> KillSwitchEvent:
        """Activate the silent kill-switch routing."""

        event = KillSwitchEvent(
            channel=channel,
            initiated_by=self.operator,
            issued_at=datetime.utcnow(),
            route=f"consentplus://{route_hint}/{channel}",
        )
        self._kill_switches.append(event)
        self._dashboard_state[f"kill:{channel}"] = event.route
        return event

    def dashboard_snapshot(self) -> Dict[str, str]:
        """Return a snapshot consumable by CLI or Zora overlays."""

        base = {
            "operator": self.operator,
            "timestamp": datetime.utcnow().isoformat(),
            "revocations": str(len(self._revocations)),
            "kill_switches": str(len(self._kill_switches)),
        }
        merged = {**base, **self._dashboard_state}
        return merged

    @property
    def revocations(self) -> List[RevocationBeacon]:
        """Expose emitted revocation beacons."""

        return list(self._revocations)

    @property
    def kill_switches(self) -> List[KillSwitchEvent]:
        """Expose kill-switch events."""

        return list(self._kill_switches)
