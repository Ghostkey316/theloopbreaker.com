"""Post-quantum verifier staging utilities (pending audit)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from secrets import token_hex
from typing import Mapping, MutableMapping

_CRYPTO_DISCLAIMER = (
    "⚠️ CRYPTOGRAPHIC MODULE DISCLAIMER: Pending external audit. Do not rely on these "
    "post-quantum verifier utilities for production settlements until a third-party "
    "council signs the audit trail."
)

_DAO_PLACEHOLDER = "dao://ghostkey316.base.eth/audit/pending"


@dataclass(frozen=True)
class PostQuantumAttestation:
    """Structured representation of a post-quantum attestation request."""

    timestamp: str
    target: str
    dao_request_id: str
    digest: str
    status: str
    payload: Mapping[str, object]

    def export(self) -> MutableMapping[str, object]:
        """Serialize the attestation for JSON logging."""

        bundle = asdict(self)
        bundle["disclaimer"] = _CRYPTO_DISCLAIMER
        return bundle


def crypto_disclaimer() -> str:
    """Return the mandatory disclaimer banner for crypto modules."""

    return _CRYPTO_DISCLAIMER


def _canonical_payload(payload: Mapping[str, object] | None) -> str:
    return json.dumps(payload or {}, sort_keys=True, separators=(",", ":"))


def submit_post_quantum_verifier(
    target: str,
    *,
    payload: Mapping[str, object] | None = None,
    status: str = "pending_external_audit",
) -> PostQuantumAttestation:
    """Create an attestation intent for external post-quantum review."""

    timestamp = datetime.now(timezone.utc).isoformat()
    serialized = _canonical_payload(payload)
    digest = hashlib.shake_256(serialized.encode("utf-8")).hexdigest(64)
    dao_request_id = f"{_DAO_PLACEHOLDER}/{token_hex(4)}"
    attestation = PostQuantumAttestation(
        timestamp=timestamp,
        target=target,
        dao_request_id=dao_request_id,
        digest=digest,
        status=status,
        payload=json.loads(serialized),
    )
    return attestation


__all__ = ["PostQuantumAttestation", "crypto_disclaimer", "submit_post_quantum_verifier"]
