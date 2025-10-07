"""Quantum-compatible privacy helpers for the Vaultfire protocol."""

from __future__ import annotations

import hashlib
import secrets
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Iterable, Iterator, Mapping, MutableMapping, Sequence

from vaultfire.security.fhe import AuroraFHEBackend, Ciphertext, FHEBackend


class PrivacyError(RuntimeError):
    """Raised when secure computation boundaries are violated."""


@dataclass(frozen=True)
class StructuredCiphertext:
    """Ciphertext wrapper carrying schema-aware metadata."""

    ciphertext: Ciphertext
    schema: Sequence[str]
    slots: Sequence[int]
    metadata: Mapping[str, Any]

    def serialize(self) -> Mapping[str, Any]:
        payload = dict(self.ciphertext.serialize())
        payload.update(
            {
                "schema": list(self.schema),
                "slots": list(self.slots),
                "structured": True,
                "metadata": {**payload.get("metadata", {}), **dict(self.metadata)},
            }
        )
        return payload

    @classmethod
    def deserialize(cls, payload: Mapping[str, Any]) -> "StructuredCiphertext":
        return cls(
            ciphertext=Ciphertext.deserialize(payload),
            schema=tuple(payload.get("schema", ())),
            slots=tuple(payload.get("slots", ())),
            metadata=dict(payload.get("metadata", {})),
        )


class QuantumSecureCipherSuite:
    """High-level orchestrator for quantum-friendly secure computation flows."""

    def __init__(self, *, backend: FHEBackend | None = None, moral_tag: str = "vaultfire::mission") -> None:
        self._backend = backend or AuroraFHEBackend()
        self._moral_tag = moral_tag

    @contextmanager
    def secure_session(self, *, allow_plaintext: bool = False) -> Iterator["_SecureSession"]:
        """Create a transient secure enclave session."""

        token = secrets.token_bytes(32)
        session = _SecureSession(
            backend=self._backend,
            moral_tag=self._moral_tag,
            token=token,
            allow_plaintext=allow_plaintext,
        )
        try:
            yield session
        finally:
            session.close()


class _SecureSession:
    """Isolated execution context bound to a single secure session."""

    def __init__(
        self,
        *,
        backend: FHEBackend,
        moral_tag: str,
        token: bytes,
        allow_plaintext: bool,
    ) -> None:
        self._backend = backend
        self._moral_tag = moral_tag
        self._token = token
        self._allow_plaintext = allow_plaintext
        self._closed = False
        self._session_fingerprint = hashlib.sha256(token).hexdigest()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _ensure_open(self) -> None:
        if self._closed:
            raise PrivacyError("secure session is closed")

    def _ensure_schema(self, schema: Sequence[str]) -> Sequence[str]:
        if not schema:
            raise PrivacyError("schema must include at least one field")
        normalised = tuple(str(field) for field in schema)
        if len(set(normalised)) != len(normalised):
            raise PrivacyError("schema contains duplicate fields")
        return normalised

    def _slot_map(self, schema: Sequence[str], record: Mapping[str, Any]) -> MutableMapping[str, Any]:
        slot_map: MutableMapping[str, Any] = {}
        for index, field in enumerate(schema):
            if field not in record:
                raise PrivacyError(f"missing field '{field}' in structured payload")
            slot_map[field] = record[field]
            if not isinstance(record[field], (int, float)):
                raise PrivacyError(f"field '{field}' must be numeric for FHE packing")
        return slot_map

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------
    def encrypt_structured(
        self,
        schema: Sequence[str],
        record: Mapping[str, Any],
        *,
        scale: int = 10**6,
        metadata: Mapping[str, Any] | None = None,
    ) -> StructuredCiphertext:
        self._ensure_open()
        normalised_schema = self._ensure_schema(schema)
        slot_map = self._slot_map(normalised_schema, record)
        ciphertext = self._backend.encrypt_record(
            payload=slot_map,
            sensitive_fields=normalised_schema,
            scale=scale,
            moral_tag=self._moral_tag,
        )
        combined_metadata = {
            "session": self._session_fingerprint,
            "slot_count": len(normalised_schema),
        }
        if metadata:
            combined_metadata.update(metadata)
        return StructuredCiphertext(
            ciphertext=ciphertext,
            schema=normalised_schema,
            slots=tuple(range(len(normalised_schema))),
            metadata=combined_metadata,
        )

    def aggregate(self, ciphertexts: Iterable[StructuredCiphertext]) -> StructuredCiphertext:
        self._ensure_open()
        ciphertexts = list(ciphertexts)
        if not ciphertexts:
            raise PrivacyError("no ciphertexts supplied for aggregation")
        schema = ciphertexts[0].schema
        if any(item.schema != schema for item in ciphertexts[1:]):
            raise PrivacyError("all ciphertexts must share the same schema")
        aggregated = self._backend.homomorphic_add(
            [item.ciphertext for item in ciphertexts],
            moral_tag=self._moral_tag,
        )
        metadata = {
            "session": self._session_fingerprint,
            "slot_count": len(schema),
            "aggregate": True,
        }
        return StructuredCiphertext(
            ciphertext=aggregated,
            schema=schema,
            slots=ciphertexts[0].slots,
            metadata=metadata,
        )

    def rescale(self, ciphertext: StructuredCiphertext, *, factor: float) -> StructuredCiphertext:
        self._ensure_open()
        if factor <= 0:
            raise PrivacyError("scale factor must be positive")
        base_value = self._backend.decrypt_scalar(ciphertext.ciphertext)
        scaled_value = base_value * factor
        backend_metadata = dict(ciphertext.ciphertext.metadata)
        backend_metadata.pop("nonce", None)
        backend_metadata.update(
            {
                "scaled": True,
                "factor": factor,
                "backend": getattr(self._backend, "backend_id", "unknown"),
                "moral_tag": self._moral_tag,
            }
        )
        rebased = self._backend.encrypt_scalar(
            scaled_value,
            scale=ciphertext.ciphertext.scale,
            metadata=backend_metadata,
            moral_tag=self._moral_tag,
        )
        metadata = dict(ciphertext.metadata)
        metadata.update({"session": self._session_fingerprint, "scaled_by": factor})
        return StructuredCiphertext(
            ciphertext=rebased,
            schema=ciphertext.schema,
            slots=ciphertext.slots,
            metadata=metadata,
        )

    def decrypt_structured(self, ciphertext: StructuredCiphertext) -> Mapping[str, Any]:
        self._ensure_open()
        if not self._allow_plaintext:
            raise PrivacyError("plaintext access disabled for this secure session")
        record = self._backend.decrypt_record(
            ciphertext.ciphertext,
            moral_tag=self._moral_tag,
        )
        reconstructed = {}
        for field in ciphertext.schema:
            if field in record:
                reconstructed[field] = record[field]
            else:
                reconstructed[field] = record.get("metadata", {}).get(field)
        if "approximate_value" in record:
            reconstructed["approximate_value"] = record["approximate_value"]
        return reconstructed

    def close(self) -> None:
        self._closed = True


_INTEGRATION_EXPORTS = {
    "ConsentGuardianLayer",
    "EchoAnonymizerEngine",
    "VaultTraceEraser",
    "GhostkeyPrivacyHalo",
    "PrivacyIntegrityShield",
    "get_privacy_shield",
}


def __getattr__(name: str):  # pragma: no cover - exercised via import semantics
    if name in _INTEGRATION_EXPORTS:
        from vaultfire import privacy_integrity as _privacy_integrity

        value = getattr(_privacy_integrity, name)
        globals()[name] = value
        return value
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "PrivacyError",
    "QuantumSecureCipherSuite",
    "StructuredCiphertext",
    *_INTEGRATION_EXPORTS,
]
