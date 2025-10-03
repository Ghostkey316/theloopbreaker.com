"""Attestation engine for signed pilot metric proofs."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from typing import Mapping, MutableMapping, Any
import hmac


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SECRET = os.getenv("VAULTFIRE_ATTESTATION_SECRET", "vaultfire-attestor-sandbox")


def _canonicalize(payload: Mapping[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


@dataclass(slots=True)
class AttestationResult:
    validator_id: str
    issued_at: str
    metrics: Mapping[str, Any]
    signature: str
    proof_hash: str

    def as_dict(self) -> MutableMapping[str, Any]:
        return {
            "validator_id": self.validator_id,
            "issued_at": self.issued_at,
            "metrics": self.metrics,
            "signature": self.signature,
            "proof_hash": self.proof_hash,
        }


def attestation_engine(
    metrics: Mapping[str, Any],
    *,
    validator_id: str = "vaultfire-attestor",
    secret: str | None = None,
    output_path: Path | None = None,
) -> AttestationResult:
    """Return a signed attestation for ``metrics`` suitable for auditors."""

    if not isinstance(metrics, Mapping):
        raise TypeError("metrics must be a mapping")
    canonical = _canonicalize(metrics)
    proof_hash = sha256(canonical.encode("utf-8")).hexdigest()
    key = (secret or DEFAULT_SECRET).encode("utf-8")
    signature = hmac.new(key, canonical.encode("utf-8"), sha256).hexdigest()
    issued_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    result = AttestationResult(
        validator_id=validator_id,
        issued_at=issued_at,
        metrics=dict(metrics),
        signature=signature,
        proof_hash=proof_hash,
    )
    if output_path:
        output_path = (BASE_DIR / output_path).resolve() if not output_path.is_absolute() else output_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as handle:
            json.dump(result.as_dict(), handle, indent=2)
            handle.write("\n")
    return result


__all__ = ["attestation_engine", "AttestationResult"]

