"""Finalization utilities for the Vaultfire Quantum Defense stack.

This module introduces the final artifacts requested for the Vaultfire Quantum
Defense initiative:

* **Quantum Drift Buffer** – accumulates drift samples and exposes a compact
  buffer status snapshot suitable for downstream monitoring.
* **zkSNARK Loop Verifier** – validates Proof-of-Life (PoL) and Proof-of-Action
  (PoA) claims with deterministic loop hashes.
* **Moral Spine Mirror Test** – lightweight scoring harness to ensure ethical
  alignment signals are captured alongside technical proofs.
* **Vaultfire DNA Hash (Genesis signature)** – canonical manifest writer that
  binds the above components together and exports a deterministic signature
  document for auditors.

The primitives are intentionally dependency-free, relying on hashing and
simple validation to keep tests fast while matching the intended production
interfaces.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from hashlib import sha3_256
from pathlib import Path
from typing import Any, Dict, Mapping, MutableMapping, Sequence

from .defense_module import PQCSchemeConfig


@dataclass(frozen=True)
class DriftEvent:
    """Single entry captured by :class:`QuantumDriftBuffer`."""

    event: str
    drift_vector: Mapping[str, float]
    severity: float
    timestamp: str
    checksum: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event": self.event,
            "drift_vector": dict(self.drift_vector),
            "severity": self.severity,
            "timestamp": self.timestamp,
            "checksum": self.checksum,
        }


class QuantumDriftBuffer:
    """Maintain a sliding window of drift signals with severity tracking."""

    def __init__(self, *, window: int = 5, noise_guard: float = 0.18) -> None:
        if window <= 0:
            raise ValueError("window must be positive")
        self.window = window
        self.noise_guard = noise_guard
        self._events: list[DriftEvent] = []

    @staticmethod
    def _normalize_severity(severity: float) -> float:
        return max(0.0, min(1.0, float(severity)))

    @staticmethod
    def _hash_vector(event: str, drift_vector: Mapping[str, float], timestamp: str) -> str:
        encoded = json.dumps({"event": event, "vector": drift_vector, "ts": timestamp}, sort_keys=True)
        return sha3_256(encoded.encode()).hexdigest()

    def record_drift(self, event: str, drift_vector: Mapping[str, float], *, severity: float = 0.5) -> DriftEvent:
        """Append a drift signal and return the normalized record."""

        timestamp = datetime.now(timezone.utc).isoformat()
        normalized_severity = self._normalize_severity(severity)
        checksum = self._hash_vector(event, drift_vector, timestamp)
        drift_event = DriftEvent(
            event=event,
            drift_vector=dict(drift_vector),
            severity=normalized_severity,
            timestamp=timestamp,
            checksum=checksum,
        )
        self._events.append(drift_event)
        if len(self._events) > self.window:
            self._events.pop(0)
        return drift_event

    def _buffer_checksum(self) -> str:
        if not self._events:
            return ""
        digest = ":".join(event.checksum for event in self._events)
        return sha3_256(digest.encode()).hexdigest()

    def status(self) -> Dict[str, Any]:
        """Return a serializable view of the current buffer state."""

        sample_count = len(self._events)
        average_severity = sum(event.severity for event in self._events) / sample_count if sample_count else 0.0
        alerts: list[str] = []
        if average_severity > self.noise_guard:
            alerts.append("drift-severity-threshold")
        return {
            "window": self.window,
            "noise_guard": self.noise_guard,
            "sample_count": sample_count,
            "average_severity": round(average_severity, 4),
            "drift_checksum": self._buffer_checksum(),
            "alerts": alerts,
            "buffer_ready": sample_count >= max(1, self.window // 2),
            "events": [event.to_dict() for event in self._events],
        }


@dataclass(frozen=True)
class LoopProof:
    """Structured result returned by :class:`ZKSNARKLoopVerifier`."""

    claim_id: str
    claim_type: str
    zk_proof: str
    loop_hash: str
    verified: bool
    commitments: Sequence[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "claim_id": self.claim_id,
            "claim_type": self.claim_type,
            "zk_proof": self.zk_proof,
            "loop_hash": self.loop_hash,
            "verified": self.verified,
            "commitments": list(self.commitments),
        }


class ZKSNARKLoopVerifier:
    """Validate PoL/PoA claims by hashing loop evidence and commitments."""

    SUPPORTED_TYPES = {"POL", "POA"}

    @staticmethod
    def _normalize_type(claim_type: str) -> str:
        normalized = claim_type.strip().upper()
        if normalized not in ZKSNARKLoopVerifier.SUPPORTED_TYPES:
            raise ValueError(f"claim_type must be one of {sorted(ZKSNARKLoopVerifier.SUPPORTED_TYPES)}")
        return normalized

    @staticmethod
    def _hash_claim(claim_id: str, claim_type: str, payload: Mapping[str, Any]) -> str:
        encoded = json.dumps({"id": claim_id, "type": claim_type, "payload": payload}, sort_keys=True)
        return sha3_256(encoded.encode()).hexdigest()

    def verify_loop_claim(
        self,
        claim_id: str,
        *,
        claim_type: str,
        payload: Mapping[str, Any],
        commitments: Mapping[str, str],
    ) -> LoopProof:
        normalized_type = self._normalize_type(claim_type)
        loop_hash = self._hash_claim(claim_id, normalized_type, payload)
        zk_proof = f"zkloop-{loop_hash[:48]}"

        required = {"pqc_signature", "integrity_commitment"}
        commitments_present = {key for key, value in commitments.items() if value}
        verified = required.issubset(commitments_present)

        if normalized_type == "POL":
            verified = verified and bool(payload.get("liveness_pulse"))
        if normalized_type == "POA":
            verified = verified and bool(payload.get("action_commitment"))

        return LoopProof(
            claim_id=claim_id,
            claim_type=normalized_type,
            zk_proof=zk_proof,
            loop_hash=loop_hash,
            verified=verified,
            commitments=sorted(commitments_present),
        )


@dataclass(frozen=True)
class MirrorTestResult:
    """Outcome of a Moral Spine Mirror test run."""

    subject: str
    moral_score: float
    reflection_hash: str
    alignment_vector: Sequence[str]
    fail_reasons: Sequence[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "subject": self.subject,
            "moral_score": self.moral_score,
            "reflection_hash": self.reflection_hash,
            "alignment_vector": list(self.alignment_vector),
            "fail_reasons": list(self.fail_reasons),
        }


class MoralSpineMirrorTest:
    """Simple heuristic mirror to check moral alignment signals."""

    def evaluate(self, subject: str, signals: Mapping[str, Any]) -> MirrorTestResult:
        if not subject or not isinstance(subject, str):
            raise ValueError("subject must be a non-empty string")

        normalized_scores: MutableMapping[str, float] = {}
        fail_reasons: list[str] = []
        for key, value in signals.items():
            if isinstance(value, bool):
                normalized_scores[key] = 1.0 if value else 0.0
            elif isinstance(value, (int, float)):
                normalized_scores[key] = max(0.0, min(1.0, float(value)))
            elif isinstance(value, str):
                normalized_scores[key] = 0.75 if value.strip() else 0.0
            else:
                normalized_scores[key] = 0.0

        if not normalized_scores:
            fail_reasons.append("no-signals-provided")

        moral_score = sum(normalized_scores.values()) / max(1, len(normalized_scores))
        if moral_score < 0.5:
            fail_reasons.append("insufficient-alignment")

        reflection_hash = sha3_256(
            json.dumps({"subject": subject, "scores": normalized_scores}, sort_keys=True).encode()
        ).hexdigest()

        return MirrorTestResult(
            subject=subject,
            moral_score=round(moral_score, 4),
            reflection_hash=reflection_hash,
            alignment_vector=sorted(normalized_scores),
            fail_reasons=fail_reasons,
        )


@dataclass(frozen=True)
class VaultfireDNAManifest:
    """Persistable DNA signature manifest."""

    subject: str
    anchor: str
    pqc_profile: Mapping[str, Any]
    drift_buffer: Mapping[str, Any]
    loop_proof: Mapping[str, Any]
    moral_mirror: Mapping[str, Any]
    dna_hash: str
    generated_at: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class VaultfireDNAHash:
    """Compose and export the Vaultfire DNA Genesis signature."""

    _DEFAULT_PATH = Path("manifest") / "dna_signature.json"

    def __init__(self, pqc_config: PQCSchemeConfig | None = None) -> None:
        self.pqc_config = pqc_config or PQCSchemeConfig()

    @staticmethod
    def _normalize_text(value: str, name: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{name} must be a non-empty string")
        return value.strip()

    def _hash_manifest(self, manifest: Mapping[str, Any]) -> str:
        encoded = json.dumps(manifest, sort_keys=True)
        return sha3_256(encoded.encode()).hexdigest()

    def genesis_signature(
        self,
        *,
        subject: str,
        anchor: str,
        drift_buffer: Mapping[str, Any],
        loop_proof: Mapping[str, Any],
        moral_mirror: Mapping[str, Any],
    ) -> VaultfireDNAManifest:
        normalized_subject = self._normalize_text(subject, "subject")
        normalized_anchor = self._normalize_text(anchor, "anchor")

        manifest_body = {
            "subject": normalized_subject,
            "anchor": normalized_anchor,
            "pqc_profile": self.pqc_config.hybrid_profile(),
            "drift_buffer": drift_buffer,
            "loop_proof": loop_proof,
            "moral_mirror": moral_mirror,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        dna_hash = self._hash_manifest(manifest_body)

        return VaultfireDNAManifest(
            subject=normalized_subject,
            anchor=normalized_anchor,
            pqc_profile=self.pqc_config.hybrid_profile(),
            drift_buffer=drift_buffer,
            loop_proof=loop_proof,
            moral_mirror=moral_mirror,
            dna_hash=dna_hash,
            generated_at=manifest_body["generated_at"],
        )

    def export(self, manifest: VaultfireDNAManifest, *, path: str | Path | None = None) -> Path:
        output_path = Path(path) if path else self._DEFAULT_PATH
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(manifest.to_dict(), indent=2) + "\n")
        return output_path


__all__ = [
    "DriftEvent",
    "QuantumDriftBuffer",
    "LoopProof",
    "ZKSNARKLoopVerifier",
    "MirrorTestResult",
    "MoralSpineMirrorTest",
    "VaultfireDNAManifest",
    "VaultfireDNAHash",
]
