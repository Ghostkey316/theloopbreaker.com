"""Mission resonance telemetry pipeline for Vaultfire pilot sessions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Mapping, MutableMapping, Optional

from vaultfire.protocol.mission_resonance import (
    ConfidentialComputeAttestor,
    MissionResonanceEngine,
    MissionSignal,
)

from .privacy import PilotPrivacyLedger

__all__ = ["ResonanceSignal", "PilotResonanceTelemetry"]


@dataclass(slots=True)
class ResonanceSignal:
    """Structured record for mission resonance telemetry exports."""

    session_id: str
    partner_tag: str
    signal: MissionSignal
    integrity_digest: Dict[str, Any]

    def export_payload(self) -> Dict[str, Any]:
        """Return a JSON serializable payload for private ledger storage."""

        payload: Dict[str, Any] = {
            "session_id": self.session_id,
            "partner_tag": self.partner_tag,
            "technique": self.signal.technique,
            "source": self.signal.source,
            "score": self.signal.score,
            "timestamp": self.signal.timestamp,
            "mission_snapshot": self.signal.mission_snapshot,
            "metadata": dict(self.signal.metadata),
        }
        return payload

    def export_metadata(self) -> Dict[str, Any]:
        """Return summary metadata suitable for ledger annotations."""

        metadata = {
            "technique": self.signal.technique,
            "resonance_index": self.integrity_digest["resonance_index"],
            "resonance_gradient": self.integrity_digest["resonance_gradient"],
            "gradient_window_seconds": self.integrity_digest["gradient_window_seconds"],
            "meets_threshold": self.integrity_digest["meets_threshold"],
        }
        return metadata


class PilotResonanceTelemetry:
    """Wraps :class:`MissionResonanceEngine` for pilot mode telemetry."""

    def __init__(
        self,
        *,
        ledger: Optional[PilotPrivacyLedger] = None,
        mission_engine: Optional[MissionResonanceEngine] = None,
        confidential_attestor: Optional[ConfidentialComputeAttestor] = None,
        accepted_measurements: Optional[Mapping[str, str]] = None,
        gradient_window_seconds: Optional[float] = None,
    ) -> None:
        self._ledger = ledger
        accepted: MutableMapping[str, str] = {
            enclave: measurement
            for enclave, measurement in (accepted_measurements or {}).items()
            if enclave and measurement
        }
        if mission_engine is not None:
            self._engine = mission_engine
            if confidential_attestor is not None:
                self._engine.attach_attestor(confidential_attestor)
                self._attestor = confidential_attestor
            else:
                existing = self._engine.attestor
                if existing is None:
                    existing = ConfidentialComputeAttestor(accepted_measurements=accepted)
                    self._engine.attach_attestor(existing)
                else:
                    for enclave, measurement in accepted.items():
                        existing.register(enclave_id=enclave, measurement=measurement)
                self._attestor = existing
        else:
            attestor = confidential_attestor or ConfidentialComputeAttestor(
                accepted_measurements=accepted
            )
            engine_window = (
                gradient_window_seconds
                if gradient_window_seconds is not None
                else None
            )
            if engine_window is None:
                self._engine = MissionResonanceEngine(confidential_attestor=attestor)
            else:
                self._engine = MissionResonanceEngine(
                    confidential_attestor=attestor,
                    gradient_window_seconds=engine_window,
                )
            self._attestor = attestor
        self._gradient_window = (
            gradient_window_seconds
            if gradient_window_seconds is not None
            else self._engine.gradient_window_seconds
        )

    @property
    def engine(self) -> MissionResonanceEngine:
        return self._engine

    @property
    def attestor(self) -> ConfidentialComputeAttestor:
        return self._attestor

    @property
    def gradient_window_seconds(self) -> float:
        return self._gradient_window

    def register_enclave(self, *, enclave_id: str, measurement: str) -> None:
        """Register additional attested enclaves for confidential telemetry."""

        self._attestor.register(enclave_id=enclave_id, measurement=measurement)

    def ingest_signal(
        self,
        *,
        partner_tag: str,
        session_id: str,
        source: str,
        technique: str,
        score: float,
        metadata: Optional[Mapping[str, Any]] = None,
        mission_override: Optional[str] = None,
    ) -> ResonanceSignal:
        """Capture a mission resonance signal and persist a private record."""

        signal = self._engine.ingest_signal(
            source=source,
            technique=technique,
            score=score,
            metadata=metadata,
            mission_override=mission_override,
        )
        digest = self._engine.integrity_report(
            gradient_window_seconds=self._gradient_window
        )
        record = ResonanceSignal(
            session_id=session_id,
            partner_tag=partner_tag,
            signal=signal,
            integrity_digest=digest,
        )
        if self._ledger is not None:
            self._ledger.record_reference(
                partner_tag=partner_tag,
                reference_type="mission-resonance",
                payload=record.export_payload(),
                metadata=record.export_metadata(),
            )
        return record

    def integrity_digest(self) -> Dict[str, Any]:
        """Return the current mission resonance integrity snapshot."""

        return self._engine.integrity_report(
            gradient_window_seconds=self._gradient_window
        )

    def attested_manifest(self) -> Mapping[str, str]:
        """Expose the attested enclave manifest."""

        return self._attestor.manifest()
