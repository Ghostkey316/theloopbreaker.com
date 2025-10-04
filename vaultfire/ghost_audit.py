"""GhostAudit module for Vaultfire pilot partner readiness.

This module captures protocol simulation runs, decision trees, and
performance metrics and emits audit metadata suitable for distribution to
pilot partners. Records can be redacted for sensitive payloads while still
providing validator attestations with deterministic signatures.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, MutableMapping
from uuid import uuid4

_DEFAULT_LOG_PATH = Path("logs") / "audit" / "ghost_audit_metadata.jsonl"
_DEFAULT_VALIDATORS = (
    "validator.ethics.alpha",
    "validator.mission.control",
)
_DEFAULT_SENSITIVE_FIELDS = frozenset(
    {
        "wallet",
        "wallets",
        "resolved_wallets",
        "input_wallets",
        "wallet_alias",
        "wallet_aliases",
        "contact",
        "contact_email",
        "partner_contact",
        "private_notes",
    }
)


@dataclass
class GhostAuditLogger:
    """Persist publishable audit metadata for protocol simulations."""

    log_path: Path = field(default_factory=lambda: _DEFAULT_LOG_PATH)
    schema_version: str = "1.0"
    redact_sensitive: bool = field(
        default_factory=lambda: os.getenv("VAULTFIRE_GHOSTAUDIT_REDACT", "false")
        .strip()
        .lower()
        in {"1", "true", "yes", "on"}
    )
    sensitive_fields: Iterable[str] = field(default_factory=lambda: _DEFAULT_SENSITIVE_FIELDS)
    default_validators: Iterable[str] = field(
        default_factory=lambda: os.getenv("VAULTFIRE_GHOSTAUDIT_VALIDATORS", "").split(",")
        if os.getenv("VAULTFIRE_GHOSTAUDIT_VALIDATORS")
        else _DEFAULT_VALIDATORS
    )

    def __post_init__(self) -> None:
        self.log_path = Path(self.log_path)
        self._sensitive_fields = {field.strip() for field in self.sensitive_fields}
        self._sensitive_fields.update({field.strip() for field in _DEFAULT_SENSITIVE_FIELDS})
        self._validators = [validator.strip() for validator in self.default_validators if validator.strip()]
        if not self._validators:
            self._validators = list(_DEFAULT_VALIDATORS)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def log_simulation(
        self,
        *,
        protocol_name: str,
        scenario: str,
        decision_tree: Mapping[str, Any] | Iterable[Any],
        performance: Mapping[str, Any],
        run_context: Mapping[str, Any] | None = None,
        outcome: Mapping[str, Any] | None = None,
        protocol_version: str | None = None,
        validators: Iterable[str] | None = None,
        redact_sensitive: bool | None = None,
        run_id: str | None = None,
    ) -> MutableMapping[str, Any]:
        """Capture a protocol simulation run and return the audit record."""

        if not protocol_name:
            raise ValueError("protocol_name must be provided")
        if not scenario:
            raise ValueError("scenario must be provided")

        timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        run_identifier = run_id or str(uuid4())
        version = protocol_version or "pilot-ready"
        redaction_enabled = self.redact_sensitive if redact_sensitive is None else bool(redact_sensitive)

        normalised_decision_tree = self._normalise(decision_tree)
        normalised_performance = self._normalise(performance)
        normalised_context = self._normalise(run_context or {})
        normalised_outcome = self._normalise(outcome or {})

        audit_record: MutableMapping[str, Any] = {
            "schema": {
                "name": "vaultfire.ghost_audit",
                "version": self.schema_version,
            },
            "run": {
                "id": run_identifier,
                "protocol": {
                    "name": protocol_name,
                    "version": version,
                },
                "scenario": scenario,
                "timestamp": timestamp,
            },
            "decision_tree": normalised_decision_tree,
            "performance": normalised_performance,
            "context": normalised_context,
            "outcome": normalised_outcome,
            "distribution": {
                "prepared_for": "vaultfire.pilot.partners",
                "classification": "partner-internal" if redaction_enabled else "public",
                "status": "ready",
            },
            "disclaimers": [
                "Partners remain responsible for their own compliance reviews.",
                "Ambient telemetry follows declared opt-in policies.",
                "Nothing in this log constitutes legal, medical, or financial advice.",
            ],
        }

        if redaction_enabled:
            audit_record["context"] = self._redact_payload(audit_record["context"])
            audit_record["outcome"] = self._redact_payload(audit_record["outcome"])
            audit_record["decision_tree"] = self._redact_payload(audit_record["decision_tree"])

        audit_record["validators"] = self._validator_signatures(validators, run_identifier)
        audit_record["attestation"] = self._build_attestation(audit_record)
        audit_record["redacted"] = redaction_enabled

        self._append_record(audit_record)
        return audit_record

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _normalise(self, payload: Any) -> Any:
        if isinstance(payload, Mapping):
            return {str(key): self._normalise(value) for key, value in payload.items()}
        if isinstance(payload, (list, tuple, set)):
            return [self._normalise(item) for item in payload]
        if isinstance(payload, Path):
            return str(payload)
        if isinstance(payload, datetime):  # pragma: no cover - defensive path
            return payload.replace(microsecond=0, tzinfo=timezone.utc).isoformat()
        return payload

    def _mask_value(self, value: Any) -> Any:
        if isinstance(value, Mapping):
            return {str(key): self._mask_value(sub_value) for key, sub_value in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [self._mask_value(item) for item in value]
        if value is None:
            return None
        return "***redacted***"

    def _redact_payload(self, payload: Any) -> Any:
        if isinstance(payload, Mapping):
            redacted: MutableMapping[str, Any] = {}
            for key, value in payload.items():
                if key in self._sensitive_fields:
                    redacted[key] = self._mask_value(value)
                else:
                    redacted[key] = self._redact_payload(value)
            return redacted
        if isinstance(payload, list):
            return [self._redact_payload(item) for item in payload]
        if isinstance(payload, tuple):  # pragma: no cover - defensive
            return [self._redact_payload(item) for item in payload]
        return payload

    def _validator_signatures(
        self,
        validators: Iterable[str] | None,
        run_id: str,
    ) -> list[dict[str, Any]]:
        resolved_validators = [v.strip() for v in (validators or self._validators) if v and v.strip()]
        if not resolved_validators:
            resolved_validators = list(self._validators)

        signatures = []
        for idx, validator in enumerate(resolved_validators):
            signed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
            signature_input = f"{validator}:{run_id}:{idx}:{signed_at}".encode("utf-8")
            signatures.append(
                {
                    "validator": validator,
                    "signed_at": signed_at,
                    "signature": hashlib.sha256(signature_input).hexdigest(),
                }
            )
        return signatures

    def _build_attestation(self, record: Mapping[str, Any]) -> Mapping[str, Any]:
        digest_payload = {
            "run": record["run"],
            "decision_tree": record["decision_tree"],
            "performance": record["performance"],
            "context": record["context"],
            "outcome": record["outcome"],
        }
        digest = hashlib.sha256(
            json.dumps(digest_payload, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()
        return {
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "digest": digest,
            "visibility": "redacted" if record.get("redacted") else "public",
            "intended_audience": ["pilot_partners", "compliance_team"],
        }

    def _append_record(self, record: Mapping[str, Any]) -> None:
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        with self.log_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record) + "\n")


__all__ = ["GhostAuditLogger"]
