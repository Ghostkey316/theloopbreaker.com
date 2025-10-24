"""Security utilities for Vaultfire mission audits."""

from __future__ import annotations

from .access_guard import (
    AccessDecision,
    MAX_UNVERIFIED_RATE_PER_MINUTE,
    evaluate_access_rate,
)
from .audit import validate_securestore_fallback
from .fhe import (
    AuroraFHEBackend,
    Ciphertext,
    ConsentProof,
    DisclosurePacket,
    FHEAuditArtifacts,
    FHECipherSuite,
    PlaceholderFHEBackend,
    PrivacyEngine,
    SoulboundKey,
)
from .guardian_trace import (
    FingerprintActivity,
    alert_identity_anomalies,
    auto_lock_unique_signal_origin,
    log_clone_attempts,
    track_fingerprint_activity,
    validate_behavior_signature,
)
from .onboarding_guardrails import OnboardingGuardrails, secure_protocol
from .post_quantum_verifier import (
    PostQuantumAttestation,
    crypto_disclaimer,
    submit_post_quantum_verifier,
)
from .resilience_simulator import (
    PilotConfig,
    PilotRunResult,
    ResilienceScenario,
    ResilienceSimulator,
    SimulationEvent,
)

__all__ = [
    "AuroraFHEBackend",
    "Ciphertext",
    "ConsentProof",
    "DisclosurePacket",
    "FHEAuditArtifacts",
    "FHECipherSuite",
    "PlaceholderFHEBackend",
    "PrivacyEngine",
    "SoulboundKey",
    "AccessDecision",
    "evaluate_access_rate",
    "MAX_UNVERIFIED_RATE_PER_MINUTE",
    "FingerprintActivity",
    "track_fingerprint_activity",
    "validate_behavior_signature",
    "alert_identity_anomalies",
    "log_clone_attempts",
    "auto_lock_unique_signal_origin",
    "validate_securestore_fallback",
    "OnboardingGuardrails",
    "secure_protocol",
    "PostQuantumAttestation",
    "crypto_disclaimer",
    "submit_post_quantum_verifier",
    "PilotConfig",
    "PilotRunResult",
    "ResilienceScenario",
    "ResilienceSimulator",
    "SimulationEvent",
]
