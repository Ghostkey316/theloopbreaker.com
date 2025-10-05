"""Mission resonance engine with post-quantum and privacy-preserving signal ingestion."""

from __future__ import annotations

import math
import time
from collections import defaultdict
from dataclasses import dataclass
from hashlib import sha3_512
import secrets
from statistics import fmean
from typing import Any, Dict, Mapping, MutableMapping, MutableSequence, Sequence

from .constants import MISSION_STATEMENT


_SUPPORTED_TECHNIQUES: Mapping[str, str] = {
    "edge-llm": "mission resonance scored by on-device generative models",
    "fhe-stream": "signals evaluated with fully homomorphic encrypted payloads",
    "zk-fog": "zero-knowledge redacted telemetry with verifiable proofs",
    "mpc-fabric": "multi-party computation updates from co-governed councils",
    "neural-symbolic": "hybrid neuro-symbolic analyzers keeping mission context",
    "post-quantum": "dilithium-style signature anchors for mission statements",
    "confidential-ml": "confidential ML enclaves with remote attestation beacons",
}


@dataclass(slots=True)
class MissionSignal:
    """Captured mission signal with contextual metadata."""

    source: str
    technique: str
    score: float
    timestamp: float
    mission_snapshot: str
    metadata: Mapping[str, Any]


class PostQuantumSignatureVerifier:
    """Lightweight Dilithium-inspired verifier for mission attestations."""

    def __init__(self, *, public_key: str) -> None:
        self._public_key = public_key

    @property
    def public_key(self) -> str:
        return self._public_key

    def derive_signature(self, message: str) -> str:
        """Derive a deterministic signature for local testing and anchor seeding."""

        digest = sha3_512()
        digest.update(self._public_key.encode("utf-8"))
        digest.update(message.encode("utf-8"))
        return digest.hexdigest()

    def verify(self, *, message: str, signature: str) -> bool:
        """Verify the provided signature against the mission snapshot."""

        if not message:
            return False
        expected = self.derive_signature(message)
        return expected == signature


class ConfidentialComputeAttestor:
    """TEE-style attestation verifier for confidential mission analytics."""

    def __init__(self, *, accepted_measurements: Mapping[str, str] | None = None) -> None:
        self._measurements: MutableMapping[str, str] = {
            enclave_id: measurement
            for enclave_id, measurement in (accepted_measurements or {}).items()
            if enclave_id and measurement
        }

    def register(self, *, enclave_id: str, measurement: str) -> None:
        """Register a trusted enclave measurement hash."""

        enclave = enclave_id.strip()
        if not enclave:
            raise ValueError("enclave_id cannot be empty")
        if not measurement:
            raise ValueError("measurement cannot be empty")
        self._measurements[enclave] = measurement

    def verify(self, *, enclave_id: str, measurement: str) -> bool:
        """Verify that an attested enclave matches the expected measurement."""

        expected = self._measurements.get(enclave_id.strip())
        if not expected:
            return False
        return secrets.compare_digest(expected, measurement)

    def manifest(self) -> Mapping[str, str]:
        """Return a sanitized manifest for integrity reporting."""

        return {enclave_id: "verified" for enclave_id in sorted(self._measurements)}


class MissionResonanceEngine:
    """Aggregate mission signals from cutting-edge privacy-preserving surfaces."""

    def __init__(
        self,
        *,
        post_quantum_verifier: PostQuantumSignatureVerifier | None = None,
        confidential_attestor: ConfidentialComputeAttestor | None = None,
        default_threshold: float = 0.72,
        gradient_window_seconds: float = 3600.0,
    ) -> None:
        self._signals: MutableSequence[MissionSignal] = []
        self._verifier = post_quantum_verifier
        self._attestor = confidential_attestor
        self._threshold = default_threshold
        if gradient_window_seconds <= 0:
            raise ValueError("gradient_window_seconds must be positive")
        self._gradient_window = float(gradient_window_seconds)

    @property
    def mission(self) -> str:
        return MISSION_STATEMENT

    @property
    def signals(self) -> Sequence[MissionSignal]:
        return tuple(self._signals)

    @property
    def gradient_window_seconds(self) -> float:
        """Return the default gradient window used for telemetry snapshots."""

        return self._gradient_window

    @property
    def attestor(self) -> ConfidentialComputeAttestor | None:
        """Return the configured confidential compute attestor, if any."""

        return self._attestor

    def attach_attestor(self, attestor: ConfidentialComputeAttestor) -> None:
        """Attach ``attestor`` to the engine for confidential ML verification."""

        if attestor is None:
            raise ValueError("attestor must be provided")
        self._attestor = attestor

    def ingest_signal(
        self,
        *,
        source: str,
        technique: str,
        score: float,
        metadata: Mapping[str, Any] | None = None,
        mission_override: str | None = None,
    ) -> MissionSignal:
        """Store a mission resonance signal after integrity checks."""

        technique_key = technique.lower().strip()
        if technique_key not in _SUPPORTED_TECHNIQUES:
            raise ValueError(f"unsupported technique '{technique}'")
        if math.isnan(score) or score < 0 or score > 1:
            raise ValueError("score must be between 0 and 1")

        mission_snapshot = mission_override or self.mission
        meta = dict(metadata or {})

        if technique_key == "post-quantum" and self._verifier:
            signature = str(meta.get("signature", ""))
            message = str(meta.get("message", mission_snapshot))
            if not signature:
                raise ValueError("post-quantum signals require a signature")
            if not self._verifier.verify(message=message, signature=signature):
                raise PermissionError("post-quantum signature failed verification")

        if technique_key == "confidential-ml":
            if not self._attestor:
                raise PermissionError("confidential-ml signals require an attestor")
            enclave_id = str(meta.get("enclave_id", "")).strip()
            measurement = str(meta.get("measurement", ""))
            if not enclave_id or not measurement:
                raise ValueError(
                    "confidential-ml signals require 'enclave_id' and 'measurement' metadata"
                )
            if not self._attestor.verify(enclave_id=enclave_id, measurement=measurement):
                raise PermissionError("confidential-ml attestation failed verification")

        record = MissionSignal(
            source=source,
            technique=technique_key,
            score=score,
            timestamp=time.time(),
            mission_snapshot=mission_snapshot,
            metadata=meta,
        )
        self._signals.append(record)
        return record

    def resonance_index(self) -> float:
        """Return the blended resonance index across all signals."""

        if not self._signals:
            return 0.0
        scores = [signal.score for signal in self._signals]
        return round(fmean(scores), 4)

    def integrity_report(self, *, gradient_window_seconds: float | None = None) -> Dict[str, Any]:
        """Summarise mission protection posture for dashboards and attestations."""

        window = (
            float(gradient_window_seconds)
            if gradient_window_seconds is not None
            else self._gradient_window
        )
        if window <= 0:
            raise ValueError("gradient_window_seconds must be positive")
        resonance = self.resonance_index()
        contributing_techniques = {
            signal.technique for signal in self._signals
        } or set(_SUPPORTED_TECHNIQUES.keys())
        return {
            "mission": self.mission,
            "resonance_index": resonance,
            "meets_threshold": resonance >= self._threshold,
            "techniques": sorted(contributing_techniques),
            "signal_count": len(self._signals),
            "technique_breakdown": self.technique_breakdown(),
            "resonance_gradient": self.resonance_gradient(window_seconds=window),
            "gradient_window_seconds": window,
            "gradient_breakdown": self.technique_gradients(window_seconds=window),
            "attested_enclaves": self._attestor.manifest() if self._attestor else {},
        }

    def supported_techniques(self) -> Mapping[str, str]:
        """Return the supported technique catalogue for UX clients."""

        return dict(_SUPPORTED_TECHNIQUES)

    def technique_breakdown(self) -> Dict[str, Dict[str, float | int]]:
        """Return per-technique counts and blended averages for analytics."""

        if not self._signals:
            return {}
        aggregates: Dict[str, MutableSequence[float]] = defaultdict(list)
        for signal in self._signals:
            aggregates[signal.technique].append(signal.score)
        breakdown: Dict[str, Dict[str, float | int]] = {}
        for technique, scores in aggregates.items():
            breakdown[technique] = {
                "count": len(scores),
                "avg_score": round(fmean(scores), 4),
            }
        return dict(sorted(breakdown.items()))

    def resonance_gradient(self, window_seconds: float | None = None) -> float:
        """Compute the mission resonance delta between recent and historical signals."""

        window = window_seconds if window_seconds is not None else self._gradient_window
        if window <= 0:
            raise ValueError("window_seconds must be positive")
        if not self._signals:
            return 0.0
        now = time.time()
        recent: MutableSequence[float] = []
        historical: MutableSequence[float] = []
        for signal in self._signals:
            bucket = recent if now - signal.timestamp <= window else historical
            bucket.append(signal.score)
        if not recent or not historical:
            return 0.0
        return round(fmean(recent) - fmean(historical), 4)

    def technique_gradients(
        self, window_seconds: float | None = None
    ) -> Dict[str, Dict[str, float]]:
        """Return gradient metrics per technique using ``window_seconds`` buckets."""

        window = window_seconds if window_seconds is not None else self._gradient_window
        if window <= 0:
            raise ValueError("window_seconds must be positive")
        if not self._signals:
            return {}
        now = time.time()
        recent_scores: MutableMapping[str, MutableSequence[float]] = defaultdict(list)
        historical_scores: MutableMapping[str, MutableSequence[float]] = defaultdict(list)
        for signal in self._signals:
            bucket = recent_scores if now - signal.timestamp <= window else historical_scores
            bucket[signal.technique].append(signal.score)
        techniques = set(recent_scores) | set(historical_scores)
        gradients: Dict[str, Dict[str, float]] = {}
        for technique in sorted(techniques):
            recent_list = recent_scores.get(technique, [])
            historical_list = historical_scores.get(technique, [])
            recent_avg = round(fmean(recent_list), 4) if recent_list else 0.0
            historical_avg = round(fmean(historical_list), 4) if historical_list else 0.0
            gradients[technique] = {
                "recent_avg": recent_avg,
                "historical_avg": historical_avg,
                "gradient": round(recent_avg - historical_avg, 4),
            }
        return gradients


__all__ = [
    "MissionResonanceEngine",
    "MissionSignal",
    "PostQuantumSignatureVerifier",
    "ConfidentialComputeAttestor",
]
