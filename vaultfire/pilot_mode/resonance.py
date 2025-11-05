"""Mission resonance telemetry pipeline for Vaultfire pilot sessions."""

from __future__ import annotations

import json
import random
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Mapping, MutableMapping, Optional, Sequence

try:
    import torch
    from torch import Tensor, nn
    from torch.utils.data import DataLoader, TensorDataset
    _HAVE_TORCH = True
except ImportError:  # pragma: no cover - CPU fallback
    torch = None  # type: ignore
    Tensor = Any  # type: ignore
    nn = None  # type: ignore
    DataLoader = None  # type: ignore
    TensorDataset = None  # type: ignore
    _HAVE_TORCH = False

try:
    from vaultfire.protocol.mission_resonance import (
        ConfidentialComputeAttestor,
        MissionResonanceEngine,
        MissionSignal,
    )
except Exception:  # pragma: no cover - fallback stubs
    @dataclass
    class MissionSignal:
        technique: str
        source: str
        score: float
        timestamp: float = 0.0
        mission_snapshot: str = "stub"
        metadata: Dict[str, Any] = None  # type: ignore[assignment]

    class ConfidentialComputeAttestor:
        def __init__(self, accepted_measurements: Optional[Mapping[str, str]] = None) -> None:
            self._manifest = dict(accepted_measurements or {})

        def register(self, enclave_id: str, measurement: str) -> None:
            self._manifest[enclave_id] = measurement

        def manifest(self) -> Mapping[str, str]:
            return self._manifest

    class MissionResonanceEngine:
        def __init__(self, confidential_attestor: Optional[ConfidentialComputeAttestor] = None, gradient_window_seconds: float = 60.0) -> None:
            self.attestor = confidential_attestor
            self.gradient_window_seconds = gradient_window_seconds

        def attach_attestor(self, attestor: ConfidentialComputeAttestor) -> None:
            self.attestor = attestor

        def ingest_signal(self, *, source: str, technique: str, score: float, metadata: Optional[Mapping[str, Any]] = None, mission_override: Optional[str] = None) -> MissionSignal:
            return MissionSignal(technique=technique, source=source, score=score, metadata=metadata or {})

        def integrity_report(self, gradient_window_seconds: Optional[float] = None) -> Dict[str, Any]:
            window = gradient_window_seconds or self.gradient_window_seconds
            return {
                "resonance_index": 0.97,
                "resonance_gradient": 0.01,
                "gradient_window_seconds": window,
                "meets_threshold": True,
            }


try:
    from .privacy import PilotPrivacyLedger
except Exception:  # pragma: no cover - fallback
    class PilotPrivacyLedger:  # type: ignore
        def record_reference(self, **_: Any) -> None:
            return None

__all__ = ["ResonanceSignal", "PilotResonanceTelemetry"]


BELIEF_LOG_PATH = Path("telemetry/belief-log.json")


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


if _HAVE_TORCH:

    class _ResonanceAutoencoder(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.encoder = nn.Sequential(
                nn.Linear(1, 8),
                nn.ReLU(),
                nn.Linear(8, 2),
            )
            self.decoder = nn.Sequential(
                nn.Linear(2, 8),
                nn.ReLU(),
                nn.Linear(8, 1),
            )

        def forward(self, x: Tensor) -> Tensor:  # type: ignore[override]
            latent = self.encoder(x)
            return self.decoder(latent)

else:  # pragma: no cover - fallback

    class _ResonanceAutoencoder:  # type: ignore[override]
        ...


class ResonanceAnomalyDetector:
    """PyTorch-powered anomaly detector tuned for mission resonance data."""

    def __init__(
        self,
        *,
        threshold: float = 0.05,
        learning_rate: float = 1e-3,
        device: Optional[torch.device] = None,
    ) -> None:
        self._threshold = threshold
        self._device = (device or torch.device("cpu")) if _HAVE_TORCH else None  # type: ignore
        if _HAVE_TORCH:
            self._model = _ResonanceAutoencoder().to(self._device)
            self._optimizer = torch.optim.Adam(self._model.parameters(), lr=learning_rate)
            self._criterion = nn.MSELoss()
        else:
            self._model = None
            self._optimizer = None
            self._criterion = None
            self._mean = 0.0
            self._std = 0.0
        self._trained = False

    def fit(self, signals: Sequence[float], *, epochs: int = 5, batch_size: int = 128) -> None:
        if not signals:
            raise ValueError("signals cannot be empty")
        if not _HAVE_TORCH:
            self._mean = statistics.mean(signals)
            self._std = statistics.pstdev(signals) if len(signals) > 1 else 0.0
            self._trained = True
            return
        tensor = torch.tensor(signals, dtype=torch.float32, device=self._device).unsqueeze(-1)
        loader = DataLoader(TensorDataset(tensor), batch_size=min(len(tensor), batch_size), shuffle=True)
        self._model.train()
        for _ in range(max(1, epochs)):
            for (batch,) in loader:
                self._optimizer.zero_grad()
                reconstructed = self._model(batch)
                loss = self._criterion(reconstructed, batch)
                loss.backward()
                self._optimizer.step()
        self._trained = True

    def score(self, values: Sequence[float]) -> Dict[str, float]:
        if not self._trained:
            raise RuntimeError("Detector must be trained via fit() before scoring")
        if not _HAVE_TORCH:
            mean = statistics.mean(values)
            error = abs(mean - self._mean)
            return {"error": error, "drift_ratio": float(min(1.0, error)), "anomaly": float(error > self._threshold)}
        tensor = torch.tensor(values, dtype=torch.float32, device=self._device).unsqueeze(-1)
        self._model.eval()
        with torch.no_grad():
            reconstructed = self._model(tensor)
        error = torch.mean(torch.abs(reconstructed - tensor)).item()
        return {"error": error, "drift_ratio": float(min(1.0, error)), "anomaly": float(error > self._threshold)}

    def is_anomalous(self, values: Sequence[float]) -> bool:
        return bool(self.score(values)["anomaly"])

    @staticmethod
    def load_belief_log(path: Path = BELIEF_LOG_PATH) -> Sequence[float]:
        if not path.exists():
            return []
        try:
            payload = json.loads(path.read_text())
        except json.JSONDecodeError:
            return []
        values = []
        for item in payload:
            if isinstance(item, dict) and "belief_multiplier" in item:
                try:
                    values.append(float(item["belief_multiplier"]))
                except (TypeError, ValueError):
                    continue
        return values

    def simulate_population(
        self,
        *,
        base_signals: Sequence[float],
        population: int = 100_000,
        noise: float = 0.01,
    ) -> Sequence[float]:
        if not base_signals:
            raise ValueError("base_signals cannot be empty")
        if not _HAVE_TORCH:
            rng = random.Random(316)
            expanded = (base_signals * ((population + len(base_signals) - 1) // len(base_signals)))[:population]
            return [value + rng.uniform(-noise, noise) for value in expanded]
        tensor = torch.tensor(base_signals, dtype=torch.float32, device=self._device)
        repeats = (population + tensor.numel() - 1) // tensor.numel()
        expanded = tensor.repeat(repeats)[:population]
        jitter = torch.randn_like(expanded) * noise
        return (expanded + jitter).cpu().tolist()
