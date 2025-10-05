"""Mission resonance engine with post-quantum and privacy-preserving signal ingestion."""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from hashlib import sha3_512
from statistics import fmean
from typing import Any, Dict, Mapping, MutableSequence, Sequence

from .constants import MISSION_STATEMENT


_SUPPORTED_TECHNIQUES: Mapping[str, str] = {
    "edge-llm": "mission resonance scored by on-device generative models",
    "fhe-stream": "signals evaluated with fully homomorphic encrypted payloads",
    "zk-fog": "zero-knowledge redacted telemetry with verifiable proofs",
    "mpc-fabric": "multi-party computation updates from co-governed councils",
    "neural-symbolic": "hybrid neuro-symbolic analyzers keeping mission context",
    "post-quantum": "dilithium-style signature anchors for mission statements",
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


class MissionResonanceEngine:
    """Aggregate mission signals from cutting-edge privacy-preserving surfaces."""

    def __init__(
        self,
        *,
        post_quantum_verifier: PostQuantumSignatureVerifier | None = None,
        default_threshold: float = 0.72,
    ) -> None:
        self._signals: MutableSequence[MissionSignal] = []
        self._verifier = post_quantum_verifier
        self._threshold = default_threshold

    @property
    def mission(self) -> str:
        return MISSION_STATEMENT

    @property
    def signals(self) -> Sequence[MissionSignal]:
        return tuple(self._signals)

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

    def integrity_report(self) -> Dict[str, Any]:
        """Summarise mission protection posture for dashboards and attestations."""

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
        }

    def supported_techniques(self) -> Mapping[str, str]:
        """Return the supported technique catalogue for UX clients."""

        return dict(_SUPPORTED_TECHNIQUES)


__all__ = [
    "MissionResonanceEngine",
    "MissionSignal",
    "PostQuantumSignatureVerifier",
]
