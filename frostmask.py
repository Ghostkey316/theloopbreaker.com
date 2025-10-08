"""Frostmask utility orchestrating ShadowFrost operational countermeasures."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Sequence


@dataclass
class JammingEvent:
    """Represents a selective signal jamming envelope."""

    level: int
    targets: Sequence[str]
    initiated_at: datetime
    duration_seconds: int


@dataclass
class DecoyContract:
    """Metadata for a decoy contract emission."""

    identifier: str
    template: str
    payload: Dict[str, str]
    honeypot: bool


@dataclass
class HoneypotProfile:
    """Configuration for honeypot misdirection."""

    channel: str
    sensitivity: float
    capture_filters: List[str]


class FrostmaskUtility:
    """Deploys Frostmask deception utilities over Vaultfire telemetry."""

    def __init__(self) -> None:
        self._jams: List[JammingEvent] = []
        self._decoys: List[DecoyContract] = []
        self._honeypots: Dict[str, HoneypotProfile] = {}
        self._legal_fuzzing_regions: Dict[str, datetime] = {}

    def jam_signal(self, level: int, targets: Sequence[str], *, duration_seconds: int = 180) -> JammingEvent:
        """Create a selective jamming envelope for the provided targets."""

        if level < 1 or level > 10:
            raise ValueError("level must be between 1 and 10")
        event = JammingEvent(
            level=level,
            targets=tuple(targets),
            initiated_at=datetime.utcnow(),
            duration_seconds=duration_seconds,
        )
        self._jams.append(event)
        return event

    def emit_decoy_contracts(
        self,
        count: int,
        template: str,
        *,
        include_honeypot: bool = True,
    ) -> List[DecoyContract]:
        """Emit the requested number of decoy contracts using the template seed."""

        if count < 1:
            raise ValueError("count must be at least 1")

        emissions: List[DecoyContract] = []
        for index in range(1, count + 1):
            identifier = f"frostmask-decoy-{index:02d}"
            payload = {"template": template, "sequence": str(index)}
            contract = DecoyContract(
                identifier=identifier,
                template=template,
                payload=payload,
                honeypot=include_honeypot and index == count,
            )
            self._decoys.append(contract)
            emissions.append(contract)
        return emissions

    def configure_honeypot(self, channel: str, sensitivity: float, *, filters: Sequence[str]) -> HoneypotProfile:
        """Configure honeypot misdirection parameters for a telemetry channel."""

        if not 0 <= sensitivity <= 1:
            raise ValueError("sensitivity must be between 0 and 1")
        profile = HoneypotProfile(
            channel=channel,
            sensitivity=sensitivity,
            capture_filters=list(filters),
        )
        self._honeypots[channel] = profile
        return profile

    def apply_legal_fuzzing(self, region: str) -> datetime:
        """Register legal fuzzing footprint protocol activation for a region."""

        activation = datetime.utcnow()
        self._legal_fuzzing_regions[region] = activation
        return activation

    @property
    def jamming_events(self) -> Sequence[JammingEvent]:
        """Expose recorded jamming envelopes."""

        return tuple(self._jams)

    @property
    def decoy_contracts(self) -> Sequence[DecoyContract]:
        """Expose recorded decoy contract emissions."""

        return tuple(self._decoys)

    @property
    def honeypots(self) -> Dict[str, HoneypotProfile]:
        """Expose configured honeypots keyed by channel."""

        return dict(self._honeypots)

    @property
    def legal_fuzzing_regions(self) -> Dict[str, datetime]:
        """Expose regions where legal fuzzing has been activated."""

        return dict(self._legal_fuzzing_regions)
