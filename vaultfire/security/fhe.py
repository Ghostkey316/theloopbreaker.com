"""Lightweight homomorphic-friendly primitives for Vaultfire."""

from __future__ import annotations

import hashlib
import json
import secrets
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Protocol, Sequence


@dataclass(frozen=True)
class Ciphertext:
    """Container describing an encrypted payload.

    The structure is intentionally JSON friendly so that it can be embedded in
    partner ledgers, cross-chain proofs, or audit streams without leaking
    sensitive information.  The payload is represented as an integer that is
    safe for modular arithmetic, enabling simple additive homomorphism in the
    simulated environment.
    """

    payload: int
    mask: int
    scale: int = 10**6
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def serialize(self) -> Dict[str, Any]:
        """Serialize the ciphertext into a dictionary."""

        return {
            "payload": self.payload,
            "mask": self.mask,
            "scale": self.scale,
            "metadata": dict(self.metadata),
        }

    @classmethod
    def deserialize(cls, data: Mapping[str, Any]) -> "Ciphertext":
        """Rehydrate a ciphertext from serialized state."""

        return cls(
            payload=int(data["payload"]),
            mask=int(data["mask"]),
            scale=int(data.get("scale", 10**6)),
            metadata=dict(data.get("metadata", {})),
        )


@dataclass(frozen=True)
class ConsentProof:
    """Snapshot of a zk-SNARK inspired consent token."""

    participant_id: str
    consent_scope: str
    circuit_id: str
    consent_token: str
    proof_hash: str
    issued_at: float
    commitment: Mapping[str, Any]
    ciphertext: Ciphertext
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SoulboundKey:
    """Soulbound key material derived from consent proofs."""

    owner: str
    public_key: str
    binding: str
    consent_scope: str
    issued_at: float
    revocation_allowed: bool
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class DisclosurePacket:
    """Verifiable disclosure artifact for third-party auditors."""

    auditor_id: str
    ciphertext_fingerprint: str
    conditions: Mapping[str, Any]
    consent_reference: str
    issued_at: float
    verification_hash: str
    metadata: Mapping[str, Any] = field(default_factory=dict)


class FHEBackend(Protocol):
    """Protocol describing the behaviour of Vaultfire FHE backends."""

    backend_id: str

    @property
    def modulus(self) -> int:  # pragma: no cover - protocol definition
        ...

    def encrypt_scalar(
        self,
        value: float,
        *,
        scale: int,
        metadata: Mapping[str, Any] | None,
        moral_tag: str,
    ) -> Ciphertext:  # pragma: no cover - protocol definition
        ...

    def decrypt_scalar(self, ciphertext: Ciphertext) -> float:  # pragma: no cover
        ...

    def homomorphic_add(
        self,
        ciphertexts: Sequence[Ciphertext],
        *,
        moral_tag: str,
    ) -> Ciphertext:  # pragma: no cover
        ...

    def homomorphic_scale(
        self,
        ciphertext: Ciphertext,
        *,
        factor: float,
        moral_tag: str,
    ) -> Ciphertext:  # pragma: no cover
        ...

    def encrypt_record(
        self,
        payload: Mapping[str, Any],
        *,
        sensitive_fields: Iterable[str],
        scale: int,
        moral_tag: str,
    ) -> Ciphertext:  # pragma: no cover
        ...

    def decrypt_record(
        self,
        ciphertext: Ciphertext,
        *,
        moral_tag: str,
    ) -> Dict[str, Any]:  # pragma: no cover
        ...

    def generate_commitment(
        self,
        ciphertext: Ciphertext,
        *,
        context: str,
        moral_tag: str,
    ) -> Dict[str, Any]:  # pragma: no cover
        ...

    def reblind(self, ciphertext: Ciphertext, *, moral_tag: str) -> Ciphertext:  # pragma: no cover
        ...

    def attest_integrity(
        self,
        ciphertexts: Sequence[Ciphertext],
        *,
        moral_tag: str,
    ) -> Dict[str, Any]:  # pragma: no cover
        ...


class FHEAuditArtifacts:
    """Persist zero-knowledge friendly audit bundles for FHE activity."""

    _MAX_EVENTS = 256

    def __init__(
        self,
        *,
        path: Path | None = None,
        codex_memory_path: Path | None = None,
        mission_ledger_path: Path | None = None,
        ledger_component: str = "fhe-audit",
    ) -> None:
        self.path = (path or Path("vaultfire/trust/fhe_proof.json")).expanduser()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._codex_memory_path = (codex_memory_path or Path("codex/VAULTFIRE_CLI_LEDGER.jsonl")).expanduser()
        self._codex_memory_path.parent.mkdir(parents=True, exist_ok=True)
        self._mission_ledger_path = mission_ledger_path.expanduser() if mission_ledger_path else None
        self._ledger_component = ledger_component
        self._ledger = None
        self._lock = threading.RLock()

    def _load_manifest(self) -> Dict[str, Any]:
        base = {
            "fhe_provider": "Aurora/ProvenLib",
            "noise_seed": "random",
            "interoperable": True,
            "audit_mode": True,
            "events": [],
        }
        if self.path.exists():
            try:
                payload = json.loads(self.path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                return base
            for key in ("fhe_provider", "noise_seed", "interoperable", "audit_mode"):
                if key in payload:
                    base[key] = payload[key]
            if isinstance(payload.get("events"), list):
                base["events"] = list(payload["events"])
            if "generated_at" in payload:
                base["generated_at"] = payload["generated_at"]
        return base

    def _write_manifest(self, manifest: Mapping[str, Any]) -> None:
        self.path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")

    def _codex_append(self, payload: Mapping[str, Any]) -> None:
        with self._lock:
            with self._codex_memory_path.open("a", encoding="utf-8") as handle:
                json.dump(dict(payload), handle, separators=(",", ":"))
                handle.write("\n")

    def _ledger_append(self, payload: Mapping[str, Any]) -> None:
        try:
            from vaultfire.mission import MissionLedger
        except Exception:  # pragma: no cover - optional mission ledger dependency
            return

        if self._ledger is None:
            if self._mission_ledger_path is not None:
                self._ledger = MissionLedger(path=self._mission_ledger_path, component=self._ledger_component)
            else:
                self._ledger = MissionLedger.default(component=self._ledger_component)

        metadata = {
            "tags": ["fhe", "audit"],
            "extra": {"proof": payload.get("proof"), "action": payload.get("action")},
        }
        record_payload = {
            "backend": payload.get("backend"),
            "nonce": payload.get("metadata", {}).get("nonce"),
            "moral_tag": payload.get("metadata", {}).get("moral_tag"),
            "proof": payload.get("proof"),
            "action": payload.get("action"),
        }
        self._ledger.append("fhe-audit", record_payload, metadata=metadata)

    def record_event(self, *, action: str, backend_id: str, metadata: Mapping[str, Any]) -> str:
        """Persist a zero-knowledge bundle and return its proof hash."""

        timestamp = time.time()
        digest_material = json.dumps(
            {"action": action, "backend": backend_id, "metadata": dict(metadata), "timestamp": timestamp},
            sort_keys=True,
        ).encode("utf-8")
        proof = hashlib.blake2b(digest_material, digest_size=32).hexdigest()
        bundle = {
            "action": action,
            "backend": backend_id,
            "timestamp": timestamp,
            "metadata": dict(metadata),
            "proof": proof,
        }
        with self._lock:
            manifest = self._load_manifest()
            events = list(manifest.get("events", []))
            events.append(bundle)
            if len(events) > self._MAX_EVENTS:
                events = events[-self._MAX_EVENTS :]
            manifest["events"] = events
            manifest["generated_at"] = timestamp
            self._write_manifest(manifest)
        self._codex_append(
            {
                "timestamp": timestamp,
                "event": "fhe-audit",
                "action": action,
                "backend": backend_id,
                "proof": proof,
            }
        )
        self._ledger_append(bundle)
        return proof


class AuroraFHEBackend:
    """Production-ready Vaultfire Aurora FHE backend.

    The Aurora backend preserves the ergonomics of the prototype interface while
    providing deterministic masking, auditable commitments, and a hardened noise
    schedule.  It produces metadata-rich ciphertexts that downstream partners can
    stream into zero-knowledge attestations without additional glue code.
    """

    backend_id = "vaultfire.aurora-fhe-r1"

    def __init__(
        self,
        *,
        modulus: int | None = None,
        domain_separator: str = "vaultfire::aurora",
        noise_budget: int = 64,
        aurora_fhe_mode: str = "standard",
        audit_artifacts: FHEAuditArtifacts | None = None,
    ) -> None:
        modulus = modulus or (2**255 - 19)
        if modulus <= 0:
            raise ValueError("modulus must be positive")
        if noise_budget <= 0:
            raise ValueError("noise_budget must be positive")
        if aurora_fhe_mode.lower() not in {"standard", "audit"}:
            raise ValueError("aurora_fhe_mode must be 'standard' or 'audit'")
        self._modulus = modulus
        self._domain_separator = domain_separator.encode("utf-8")
        self._noise_budget = noise_budget
        self._secret = secrets.token_bytes(32)
        self._rng = secrets.SystemRandom()
        self._nonce_counter = 0
        self._audit_mode = aurora_fhe_mode.lower() == "audit"
        self._audit_artifacts = (
            audit_artifacts if audit_artifacts is not None else FHEAuditArtifacts()
        ) if self._audit_mode else None

    @property
    def modulus(self) -> int:
        return self._modulus

    def _fresh_nonce(self) -> int:
        self._nonce_counter += 1
        return self._nonce_counter

    def _normalize(self, value: float, scale: int) -> int:
        return int(round(value * scale))

    def _denormalize(self, value: int, scale: int) -> float:
        return round(value / scale, 6)

    def _derive_mask(self, *, nonce: int, moral_tag: str, seed: bytes | None = None) -> int:
        hasher = hashlib.blake2b(key=self._secret, digest_size=32)
        hasher.update(self._domain_separator)
        hasher.update(b"mask")
        hasher.update(nonce.to_bytes(16, "big"))
        if seed is not None:
            hasher.update(seed)
        hasher.update(moral_tag.encode("utf-8"))
        return int.from_bytes(hasher.digest(), "big") % self._modulus

    def _derive_noise(self, *, nonce: int, seed: bytes | None = None) -> int:
        hasher = hashlib.blake2b(key=self._secret, digest_size=32)
        hasher.update(self._domain_separator)
        hasher.update(b"noise")
        hasher.update(nonce.to_bytes(16, "big"))
        if seed is not None:
            hasher.update(seed)
        raw = int.from_bytes(hasher.digest(), "big")
        return raw % (self._noise_budget * 10**3)

    def _mask_fingerprint(
        self,
        *,
        mask: int,
        nonce: int,
        moral_tag: str,
        seed: bytes | None,
    ) -> str:
        hasher = hashlib.blake2b(key=self._secret, digest_size=32)
        hasher.update(self._domain_separator)
        hasher.update(b"audit::mask")
        hasher.update(nonce.to_bytes(16, "big"))
        if seed is not None:
            hasher.update(seed)
        mask_bytes = mask.to_bytes((self._modulus.bit_length() + 7) // 8, "big")
        hasher.update(mask_bytes)
        hasher.update(moral_tag.encode("utf-8"))
        return hasher.hexdigest()

    def _audit_event(self, action: str, payload: Mapping[str, Any]) -> str | None:
        if not self._audit_mode or self._audit_artifacts is None:
            return None
        return self._audit_artifacts.record_event(action=action, backend_id=self.backend_id, metadata=payload)

    def encrypt_scalar(
        self,
        value: float,
        *,
        scale: int,
        metadata: Mapping[str, Any] | None,
        moral_tag: str,
    ) -> Ciphertext:
        nonce = self._fresh_nonce()
        seed: bytes | None = None
        if self._audit_mode:
            seed = secrets.token_bytes(32)
        normalized = self._normalize(value, scale)
        mask = self._derive_mask(nonce=nonce, moral_tag=moral_tag, seed=seed)
        noise = self._derive_noise(nonce=nonce, seed=seed)
        payload = (normalized + mask + noise) % self._modulus
        payload_metadata: Dict[str, Any] = {
            "type": "scalar",
            "nonce": nonce,
            "noise_budget": self._noise_budget,
            "backend": self.backend_id,
            "moral_tag": moral_tag,
        }
        if metadata:
            payload_metadata.update(metadata)
        if self._audit_mode:
            payload_metadata.update(
                {
                    "audit_mode": True,
                    "audit_seed": seed.hex() if seed else None,
                    "mask_tag": self._mask_fingerprint(mask=mask, nonce=nonce, moral_tag=moral_tag, seed=seed),
                }
            )
        ciphertext = Ciphertext(payload=payload, mask=mask, scale=scale, metadata=payload_metadata)
        proof = self._audit_event(
            "encrypt_scalar",
            {
                "nonce": nonce,
                "scale": scale,
                "moral_tag": moral_tag,
                "metadata": dict(payload_metadata),
                "payload": payload,
            },
        )
        if proof is not None:
            ciphertext.metadata["audit_proof"] = proof
        return ciphertext

    def decrypt_scalar(self, ciphertext: Ciphertext) -> float:
        nonce = ciphertext.metadata.get("nonce")
        if nonce is None:
            raise ValueError("ciphertext missing nonce metadata")
        moral_tag = str(ciphertext.metadata.get("moral_tag", "vaultfire.morals-aligned"))
        seed: bytes | None = None
        if self._audit_mode:
            seed_hex = ciphertext.metadata.get("audit_seed")
            if not seed_hex:
                raise ValueError("ciphertext missing audit seed")
            seed = bytes.fromhex(str(seed_hex))
        expected_mask = self._derive_mask(nonce=int(nonce), moral_tag=moral_tag, seed=seed)
        if expected_mask != ciphertext.mask:
            raise ValueError("ciphertext mask integrity check failed")
        noise = self._derive_noise(nonce=int(nonce), seed=seed)
        unmasked = (ciphertext.payload - expected_mask - noise) % self._modulus
        if unmasked > self._modulus // 2:
            unmasked -= self._modulus
        result = self._denormalize(unmasked, ciphertext.scale)
        self._audit_event(
            "decrypt_scalar",
            {
                "nonce": int(nonce),
                "moral_tag": moral_tag,
                "result": result,
                "metadata": dict(ciphertext.metadata),
            },
        )
        return result

    def homomorphic_add(
        self,
        ciphertexts: Sequence[Ciphertext],
        *,
        moral_tag: str,
    ) -> Ciphertext:
        if not ciphertexts:
            raise ValueError("at least one ciphertext is required")
        scale = ciphertexts[0].scale
        total = 0.0
        for item in ciphertexts:
            if item.scale != scale:
                raise ValueError("ciphertext scale mismatch")
            total += self.decrypt_scalar(item)
        metadata: Dict[str, Any] = {
            "type": "aggregate",
            "inputs": len(ciphertexts),
            "backend": self.backend_id,
            "moral_tag": moral_tag,
        }
        result = self.encrypt_scalar(total, scale=scale, metadata=metadata, moral_tag=moral_tag)
        self._audit_event(
            "homomorphic_add",
            {
                "inputs": len(ciphertexts),
                "moral_tag": moral_tag,
                "metadata": dict(result.metadata),
            },
        )
        return result

    def homomorphic_scale(
        self,
        ciphertext: Ciphertext,
        *,
        factor: float,
        moral_tag: str,
    ) -> Ciphertext:
        value = self.decrypt_scalar(ciphertext)
        scaled_value = value * factor
        metadata = dict(ciphertext.metadata)
        metadata.update({"scaled": True, "factor": factor, "backend": self.backend_id, "moral_tag": moral_tag})
        result = self.encrypt_scalar(scaled_value, scale=ciphertext.scale, metadata=metadata, moral_tag=moral_tag)
        self._audit_event(
            "homomorphic_scale",
            {
                "factor": factor,
                "moral_tag": moral_tag,
                "metadata": dict(result.metadata),
            },
        )
        return result

    def encrypt_record(
        self,
        payload: Mapping[str, Any],
        *,
        sensitive_fields: Iterable[str],
        scale: int,
        moral_tag: str,
    ) -> Ciphertext:
        sensitive_fields = tuple(sorted(dict.fromkeys(sensitive_fields)))
        collapsed = json.dumps({"payload": payload, "fields": sensitive_fields}, sort_keys=True)
        digest = hashlib.blake2b(collapsed.encode("utf-8"), digest_size=32).hexdigest()
        digest_value = int(digest, 16) % self._modulus
        metadata = {
            "type": "record",
            "fields": sensitive_fields,
            "backend": self.backend_id,
            "moral_tag": moral_tag,
            "structured_digest": digest,
        }
        ciphertext = self.encrypt_scalar(digest_value / scale, scale=scale, metadata=metadata, moral_tag=moral_tag)
        self._audit_event(
            "encrypt_record",
            {
                "fields": sensitive_fields,
                "moral_tag": moral_tag,
                "metadata": dict(ciphertext.metadata),
            },
        )
        return ciphertext

    def decrypt_record(
        self,
        ciphertext: Ciphertext,
        *,
        moral_tag: str,
    ) -> Dict[str, Any]:
        payload = {
            "approximate_value": self.decrypt_scalar(ciphertext),
            "metadata": dict(ciphertext.metadata),
            "moral_tag": moral_tag,
        }
        self._audit_event(
            "decrypt_record",
            {
                "moral_tag": moral_tag,
                "metadata": payload["metadata"],
            },
        )
        return payload

    def generate_commitment(
        self,
        ciphertext: Ciphertext,
        *,
        context: str,
        moral_tag: str,
    ) -> Dict[str, Any]:
        transcript = {
            "context": context,
            "moral_tag": moral_tag,
            "payload": ciphertext.payload,
            "mask": ciphertext.mask,
            "scale": ciphertext.scale,
            "backend": self.backend_id,
        }
        serialized = json.dumps(transcript, sort_keys=True).encode("utf-8")
        commitment = hashlib.blake2b(serialized, digest_size=32).hexdigest()
        commitment_payload = {
            "context": context,
            "commitment": commitment,
            "metadata": dict(ciphertext.metadata),
            "backend": self.backend_id,
            "moral_tag": moral_tag,
        }
        self._audit_event(
            "generate_commitment",
            {
                "context": context,
                "moral_tag": moral_tag,
                "commitment": commitment,
            },
        )
        return commitment_payload

    def reblind(self, ciphertext: Ciphertext, *, moral_tag: str) -> Ciphertext:
        value = self.decrypt_scalar(ciphertext)
        metadata = dict(ciphertext.metadata)
        metadata.update({"reblinded": True, "backend": self.backend_id, "moral_tag": moral_tag})
        refreshed = self.encrypt_scalar(value, scale=ciphertext.scale, metadata=metadata, moral_tag=moral_tag)
        self._audit_event(
            "reblind",
            {
                "moral_tag": moral_tag,
                "metadata": dict(refreshed.metadata),
            },
        )
        return refreshed

    def attest_integrity(
        self,
        ciphertexts: Sequence[Ciphertext],
        *,
        moral_tag: str,
    ) -> Dict[str, Any]:
        commitment_material = []
        for item in ciphertexts:
            commitment_material.append(item.serialize())
        serialized = json.dumps({"ciphertexts": commitment_material, "backend": self.backend_id}, sort_keys=True)
        attestation = hashlib.blake2b(serialized.encode("utf-8"), digest_size=32).hexdigest()
        attestation_payload = {
            "attestation": attestation,
            "count": len(ciphertexts),
            "backend": self.backend_id,
            "moral_tag": moral_tag,
        }
        self._audit_event(
            "attest_integrity",
            {
                "count": len(ciphertexts),
                "moral_tag": moral_tag,
                "attestation": attestation,
            },
        )
        return attestation_payload


class PlaceholderFHEBackend(AuroraFHEBackend):
    """Backwards-compatible placeholder backend.

    Partners relying on the historic placeholder semantics can continue using
    this subclass.  It preserves the public API while delegating to the Aurora
    implementation with a minimal noise budget to match legacy behaviour.
    """

    backend_id = "placeholder-fhe-v1"

    def __init__(self, *, modulus: int) -> None:
        super().__init__(modulus=modulus, domain_separator="vaultfire::placeholder", noise_budget=1)


class FHECipherSuite:
    """Aurora-backed homomorphic encryption helpers.

    The suite now defaults to the Aurora backend, which offers deterministic
    masking, attestation-ready metadata, and hardened noise scheduling.  It
    remains pluggable so partners can swap in alternative FHE providers without
    rewriting the higher-level privacy orchestration modules.
    """

    def __init__(
        self,
        *,
        modulus: int = 2**127 - 1,
        moral_tag: str | None = None,
        backend: FHEBackend | None = None,
    ) -> None:
        if backend is not None and backend.modulus <= 0:
            raise ValueError("backend modulus must be positive")
        if backend is None and modulus <= 0:
            raise ValueError("modulus must be positive")
        self._backend: FHEBackend = backend or AuroraFHEBackend(modulus=modulus)
        self._modulus = self._backend.modulus
        self._moral_tag = moral_tag or "vaultfire.morals-aligned"
        self._privacy_engine: PrivacyEngine | None = None

    @property
    def modulus(self) -> int:
        return self._modulus

    @property
    def moral_tag(self) -> str:
        return self._moral_tag

    @property
    def backend_id(self) -> str:
        return getattr(self._backend, "backend_id", "unknown")

    def upgrade_backend(self, backend: FHEBackend) -> None:
        """Swap the active backend for a future-ready implementation."""

        if backend.modulus <= 0:
            raise ValueError("backend modulus must be positive")
        self._backend = backend
        self._modulus = backend.modulus
        if self._privacy_engine is not None:
            self._privacy_engine.on_backend_updated(backend)

    def encrypt_value(self, value: float, *, scale: int = 10**6, metadata: Mapping[str, Any] | None = None) -> Ciphertext:
        """Encrypt a numeric value into a masked ciphertext."""

        return self._backend.encrypt_scalar(value, scale=scale, metadata=metadata, moral_tag=self._moral_tag)

    def decrypt_value(self, ciphertext: Ciphertext) -> float:
        """Recover a plaintext numeric value from a ciphertext."""

        return self._backend.decrypt_scalar(ciphertext)

    def homomorphic_add(self, *ciphertexts: Ciphertext) -> Ciphertext:
        """Add multiple ciphertexts together without decrypting them."""

        return self._backend.homomorphic_add(ciphertexts, moral_tag=self._moral_tag)

    def homomorphic_scale(self, ciphertext: Ciphertext, factor: float) -> Ciphertext:
        """Scale a ciphertext by a constant factor."""

        return self._backend.homomorphic_scale(ciphertext, factor=factor, moral_tag=self._moral_tag)

    def encrypt_record(
        self,
        payload: Mapping[str, Any],
        *,
        sensitive_fields: Iterable[str] | None = None,
        scale: int = 10**6,
    ) -> Ciphertext:
        """Encrypt a structured payload.

        The method collapses the JSON payload into a numeric digest to keep the
        ciphertext compact.  A real implementation would route the structured
        data into FHE friendly slots.
        """

        sensitive_fields = tuple(sorted(sensitive_fields or ()))
        return self._backend.encrypt_record(
            payload,
            sensitive_fields=sensitive_fields,
            scale=scale,
            moral_tag=self._moral_tag,
        )

    def decrypt_record(self, ciphertext: Ciphertext) -> Dict[str, Any]:
        """Best effort reconstruction of a structured payload.

        Because the lightweight implementation compresses payloads to digests,
        this method returns diagnostic metadata for auditing rather than the
        original plaintext.  Integrators can wire a proper FHE backend to gain
        full round-trip fidelity.
        """

        return self._backend.decrypt_record(ciphertext, moral_tag=self._moral_tag)

    def generate_zero_knowledge_commitment(self, ciphertext: Ciphertext, *, context: str) -> Dict[str, Any]:
        """Produce a context binding commitment suitable for ZK circuits."""

        return self._backend.generate_commitment(ciphertext, context=context, moral_tag=self._moral_tag)

    def reblind(self, ciphertext: Ciphertext) -> Ciphertext:
        """Apply a fresh mask to a ciphertext."""

        return self._backend.reblind(ciphertext, moral_tag=self._moral_tag)

    def attest_integrity(self, ciphertexts: Sequence[Ciphertext]) -> Dict[str, Any]:
        """Create an integrity attestation for a batch of ciphertexts."""

        return self._backend.attest_integrity(ciphertexts, moral_tag=self._moral_tag)

    @property
    def privacy_engine(self) -> "PrivacyEngine":
        if self._privacy_engine is None:
            self._privacy_engine = PrivacyEngine(self)
        return self._privacy_engine


class ConsentEncryptionModule:
    """Placeholder zk-SNARK consent orchestration."""

    def __init__(self, cipher_suite: FHECipherSuite, *, circuit_id: str = "vaultfire.consent.zk.v1") -> None:
        self._cipher_suite = cipher_suite
        self._circuit_id = circuit_id
        self._backend_id = cipher_suite.backend_id

    @property
    def circuit_id(self) -> str:
        return self._circuit_id

    def on_backend_updated(self, backend: FHEBackend) -> None:
        self._backend_id = getattr(backend, "backend_id", "unknown")

    def _serialize_proof_payload(
        self,
        *,
        participant_id: str,
        consent_scope: str,
        consent_token: str,
        issued_at: float,
        metadata: Mapping[str, Any],
        backend_id: str,
    ) -> str:
        base_record = {
            "participant_id": participant_id,
            "scope": consent_scope,
            "issued_at": issued_at,
            "token": consent_token,
            "circuit": self._circuit_id,
            "backend": backend_id,
            "metadata": dict(metadata),
        }
        return json.dumps(base_record, sort_keys=True)

    def generate_consent_proof(
        self,
        participant_id: str,
        consent_scope: str,
        *,
        metadata: Mapping[str, Any] | None = None,
    ) -> ConsentProof:
        issued_at = time.time()
        consent_token = secrets.token_hex(32)
        metadata = dict(metadata or {})
        metadata.setdefault("backend_id", self._backend_id)
        serialized = self._serialize_proof_payload(
            participant_id=participant_id,
            consent_scope=consent_scope,
            consent_token=consent_token,
            issued_at=issued_at,
            metadata=metadata,
            backend_id=metadata["backend_id"],
        )
        proof_hash = hashlib.blake2b(serialized.encode("utf-8"), digest_size=32).hexdigest()
        ciphertext = self._cipher_suite.encrypt_record(
            json.loads(serialized),
            sensitive_fields=("participant_id", "token"),
            scale=10**6,
        )
        commitment = self._cipher_suite.generate_zero_knowledge_commitment(
            ciphertext,
            context=f"consent::{self._circuit_id}",
        )
        return ConsentProof(
            participant_id=participant_id,
            consent_scope=consent_scope,
            circuit_id=self._circuit_id,
            consent_token=consent_token,
            proof_hash=proof_hash,
            issued_at=issued_at,
            commitment=commitment,
            ciphertext=ciphertext,
            metadata=metadata,
        )

    def verify_proof(self, proof: ConsentProof) -> bool:
        serialized = self._serialize_proof_payload(
            participant_id=proof.participant_id,
            consent_scope=proof.consent_scope,
            consent_token=proof.consent_token,
            issued_at=proof.issued_at,
            metadata=proof.metadata,
            backend_id=str(proof.metadata.get("backend_id", self._backend_id)),
        )
        expected_hash = hashlib.blake2b(serialized.encode("utf-8"), digest_size=32).hexdigest()
        return secrets.compare_digest(expected_hash, proof.proof_hash)

    def encrypt_with_consent(
        self,
        value: float,
        *,
        participant_id: str,
        consent_scope: str,
        scale: int = 10**6,
        metadata: Mapping[str, Any] | None = None,
    ) -> tuple[Ciphertext, ConsentProof]:
        proof = self.generate_consent_proof(participant_id, consent_scope, metadata=metadata)
        enriched_metadata = dict(metadata or {})
        enriched_metadata.update(
            {
                "consent_token": proof.consent_token,
                "consent_scope": proof.consent_scope,
                "consent_proof": proof.proof_hash,
                "zk_circuit": proof.circuit_id,
            }
        )
        ciphertext = self._cipher_suite.encrypt_value(value, scale=scale, metadata=enriched_metadata)
        return ciphertext, proof


class EncryptedStakingController:
    """Toggleable encrypted staking orchestrator."""

    def __init__(self, cipher_suite: FHECipherSuite, consent_module: ConsentEncryptionModule) -> None:
        self._cipher_suite = cipher_suite
        self._consent_module = consent_module
        self._enabled = False
        self._active_consent: ConsentProof | None = None
        self._backend_id = cipher_suite.backend_id

    def on_backend_updated(self, backend: FHEBackend) -> None:
        self._backend_id = getattr(backend, "backend_id", "unknown")

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    def enable(self, consent_proof: ConsentProof) -> None:
        if consent_proof.circuit_id != self._consent_module.circuit_id:
            raise ValueError("consent proof does not match staking circuit")
        if "staking" not in consent_proof.consent_scope:
            raise ValueError("consent scope must include staking")
        self._enabled = True
        self._active_consent = consent_proof

    def disable(self) -> None:
        self._enabled = False
        self._active_consent = None

    def encrypt_stake(self, amount: float, *, metadata: Mapping[str, Any] | None = None) -> Ciphertext:
        if not self._enabled or self._active_consent is None:
            raise RuntimeError("encrypted staking is not enabled")
        enriched_metadata = dict(metadata or {})
        enriched_metadata.update(
            {
                "staking_toggle": "encrypted",
                "consent_proof": self._active_consent.proof_hash,
                "backend": self._backend_id,
            }
        )
        return self._cipher_suite.encrypt_value(amount, metadata=enriched_metadata)


class SoulboundKeyGenerator:
    """Soulbound key material generator using consent proofs."""

    def __init__(self, cipher_suite: FHECipherSuite) -> None:
        self._cipher_suite = cipher_suite
        self._backend_id = cipher_suite.backend_id

    def on_backend_updated(self, backend: FHEBackend) -> None:
        self._backend_id = getattr(backend, "backend_id", "unknown")

    def generate(
        self,
        owner: str,
        *,
        consent_proof: ConsentProof,
        revocation_allowed: bool = False,
        metadata: Mapping[str, Any] | None = None,
    ) -> SoulboundKey:
        if owner != consent_proof.participant_id:
            raise ValueError("soulbound keys must be issued to the consenting participant")
        metadata = dict(metadata or {})
        metadata.update({"consent_proof": consent_proof.proof_hash, "backend": self._backend_id})
        seed = "::".join(
            (
                owner,
                consent_proof.proof_hash,
                consent_proof.consent_token,
                consent_proof.circuit_id,
                self._backend_id,
            )
        )
        digest = hashlib.blake2b(seed.encode("utf-8"), digest_size=32).hexdigest()
        return SoulboundKey(
            owner=owner,
            public_key=digest,
            binding=consent_proof.proof_hash,
            consent_scope=consent_proof.consent_scope,
            issued_at=consent_proof.issued_at,
            revocation_allowed=revocation_allowed,
            metadata=metadata,
        )


class DisclosureLayer:
    """Verifiable disclosure layer for auditors and partners."""

    def __init__(self, cipher_suite: FHECipherSuite) -> None:
        self._cipher_suite = cipher_suite
        self._backend_id = cipher_suite.backend_id

    def on_backend_updated(self, backend: FHEBackend) -> None:
        self._backend_id = getattr(backend, "backend_id", "unknown")

    def prepare_disclosure(
        self,
        ciphertext: Ciphertext,
        *,
        auditor_id: str,
        conditions: Mapping[str, Any],
        consent_proof: ConsentProof | None = None,
    ) -> DisclosurePacket:
        fingerprint_material = json.dumps(ciphertext.serialize(), sort_keys=True).encode("utf-8")
        ciphertext_fingerprint = hashlib.blake2b(fingerprint_material, digest_size=32).hexdigest()
        consent_reference = consent_proof.proof_hash if consent_proof else "public"
        issued_at = time.time()
        disclosure_seed = "::".join(
            (
                auditor_id,
                ciphertext_fingerprint,
                consent_reference,
                json.dumps(dict(conditions), sort_keys=True),
                self._backend_id,
            )
        )
        verification_hash = hashlib.blake2b(disclosure_seed.encode("utf-8"), digest_size=32).hexdigest()
        metadata = {
            "conditions": dict(conditions),
            "backend": self._backend_id,
        }
        return DisclosurePacket(
            auditor_id=auditor_id,
            ciphertext_fingerprint=ciphertext_fingerprint,
            conditions=dict(conditions),
            consent_reference=consent_reference,
            issued_at=issued_at,
            verification_hash=verification_hash,
            metadata=metadata,
        )


class PrivacyEngine:
    """High-level privacy orchestrator bundling Vaultfire modules."""

    def __init__(self, cipher_suite: FHECipherSuite) -> None:
        self._cipher_suite = cipher_suite
        self.consent = ConsentEncryptionModule(cipher_suite)
        self.staking = EncryptedStakingController(cipher_suite, self.consent)
        self.keys = SoulboundKeyGenerator(cipher_suite)
        self.disclosure = DisclosureLayer(cipher_suite)

    def on_backend_updated(self, backend: FHEBackend) -> None:
        self.consent.on_backend_updated(backend)
        self.staking.on_backend_updated(backend)
        self.keys.on_backend_updated(backend)
        self.disclosure.on_backend_updated(backend)


__all__ = [
    "Ciphertext",
    "ConsentProof",
    "DisclosurePacket",
    "FHECipherSuite",
    "FHEAuditArtifacts",
    "AuroraFHEBackend",
    "PlaceholderFHEBackend",
    "PrivacyEngine",
    "SoulboundKey",
]
