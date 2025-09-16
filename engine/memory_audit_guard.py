"""Vaultfire Law 8: Memory Audit Protocol.

This module implements a tamper-proof audit layer that traces every memory
mutation inside the Vaultfire stack.  The guard collaborates with
``remembrance_guard`` to surface overlooked contributors, calls into
``alignment_guard`` for moral alignment scoring, and defers to
``guardian_of_origin`` (when available) for origin integrity checks.  Each
recorded action receives an immutable audit lock and Codex-signed timestamp so
that historical belief states can be reconstructed exactly as they happened.
"""
from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence

from .alignment_guard import evaluate_alignment
from .remembrance_guard import RemembranceGuard

try:  # pragma: no cover - optional dependency for environments without guardian
    from .guardian_of_origin import enforce_origin as _default_origin_enforcer
except Exception:  # pragma: no cover - guardian module not available
    _default_origin_enforcer = None  # type: ignore

from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parents[1]
MEMORY_AUDIT_LOG_PATH = BASE_DIR / "logs" / "memory_audit_log.json"
LAW_TITLE = "Vaultfire Law 8: Memory Audit Protocol"

REQUIRES_JUSTIFICATION = {
    "mission_change",
    "contributor_reclassification",
    "scale_authorization",
    "retroactive_change",
    "rollback",
}


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    return " ".join(text.split())


def _tokenize(text: str) -> List[str]:
    tokens: List[str] = []
    for raw in text.lower().replace("-", " ").split():
        cleaned = "".join(ch for ch in raw if ch.isalnum())
        if cleaned:
            tokens.append(cleaned)
    return tokens


def _semantic_fingerprint(prior: str, new: str) -> Dict[str, List[str]]:
    prior_tokens = set(_tokenize(prior))
    new_tokens = set(_tokenize(new))
    delta = sorted((new_tokens ^ prior_tokens))
    fingerprint = {
        "prior": sorted(prior_tokens),
        "new": sorted(new_tokens),
        "delta": delta,
    }
    union = prior_tokens | new_tokens
    if not union:
        drift = 0.0
    else:
        drift = 1.0 - (len(prior_tokens & new_tokens) / len(union))
    fingerprint["drift_score"] = round(drift, 6)
    return fingerprint


def _coerce_float(value: Any, default: float | None = None) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        if default is None:
            raise
        return float(default)


def _resolve_target_id(payload: Mapping[str, Any]) -> str | None:
    keys = (
        "memory_id",
        "memory_block",
        "chain_id",
        "target_id",
        "id",
        "mission_id",
        "contributor_id",
    )
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _identity_tag(identity: Mapping[str, Any] | None) -> str | None:
    if not identity:
        return None
    for key in ("ens", "user_id", "wallet", "address", "id", "identity"):
        value = identity.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _collect_tags(payload: Mapping[str, Any]) -> List[str]:
    tags_field = payload.get("tags") or payload.get("labels") or []
    if isinstance(tags_field, (str, bytes)):
        return [str(tags_field)] if tags_field else []
    if isinstance(tags_field, Iterable):
        return [str(item) for item in tags_field if item]
    return []


def _canonical_payload(payload: Mapping[str, Any]) -> Dict[str, Any]:
    base = {key: payload[key] for key in payload if key != "signature"}
    return json.loads(json.dumps(base, sort_keys=True))


@dataclass
class MemoryAuditResult:
    """Envelope describing the outcome of an audited memory action."""

    allowed: bool
    decision: str
    audit_lock_id: str
    codex_signature: str
    belief_drift: float
    belief_density_shift: float
    codex_violation_flags: List[str]
    review_enqueued: bool
    record: Dict[str, Any]

    @property
    def remembrance_alerts(self) -> List[Dict[str, Any]]:
        alerts = self.record.get("remembrance_alerts")
        if isinstance(alerts, list):
            return alerts
        return []


class MemoryAuditGuard:
    """Codex-backed enforcement engine for Vaultfire memory integrity."""

    def __init__(
        self,
        belief_logs: Sequence[Mapping[str, Any]] | None,
        memory_chains: Sequence[Mapping[str, Any]] | None,
        *,
        audit_log_path: Path | str | None = None,
        origin_enforcer: Optional[Any] = None,
        codex_seed: str = "vaultfire-codex",
        drift_alert_threshold: float = 0.35,
        belief_shift_threshold: float = 0.12,
    ) -> None:
        self.codex_seed = codex_seed
        self.drift_alert_threshold = drift_alert_threshold
        self.belief_shift_threshold = belief_shift_threshold
        self.audit_log_path = Path(audit_log_path) if audit_log_path else MEMORY_AUDIT_LOG_PATH

        self.remembrance_guard = RemembranceGuard(belief_logs or [], memory_chains or [])
        self.origin_enforcer = origin_enforcer or _default_origin_enforcer

        existing_log = load_json(self.audit_log_path, [])
        if not isinstance(existing_log, list):
            existing_log = []
        self.memory_action_log: List[Dict[str, Any]] = [
            dict(entry) for entry in existing_log if isinstance(entry, Mapping)
        ]
        self._memory_state: Dict[str, Dict[str, Any]] = {}
        for entry in self.memory_action_log:
            target_id = entry.get("target_id")
            state = entry.get("new_state")
            if isinstance(target_id, str) and isinstance(state, Mapping):
                self._memory_state[target_id] = dict(state)

        self.review_queue: List[Dict[str, Any]] = []

    # ------------------------------------------------------------------
    # Signature helpers
    # ------------------------------------------------------------------
    def _sign_payload(self, payload: Mapping[str, Any]) -> str:
        canonical = _canonical_payload(payload)
        encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256((encoded + self.codex_seed).encode("utf-8")).hexdigest()

    def verify_signed_payload(self, payload: Mapping[str, Any]) -> bool:
        signature = payload.get("signature")
        if not isinstance(signature, str) or not signature:
            return False
        expected = self._sign_payload(payload)
        return signature == expected

    def prepare_rollback_payload(self, target_id: str, snapshot: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
        state = snapshot or self._memory_state.get(target_id)
        if state is None:
            raise KeyError(f"No memory snapshot available for {target_id}")
        payload: Dict[str, Any] = {
            "target_id": target_id,
            "snapshot": deepcopy(dict(state)),
            "issued_at": _now(),
        }
        payload["signature"] = self._sign_payload(payload)
        return payload

    # ------------------------------------------------------------------
    # Primary audit interface
    # ------------------------------------------------------------------
    def audit_memory_action(
        self,
        action_type: str,
        payload: Mapping[str, Any],
        *,
        identity: Optional[Mapping[str, Any]] = None,
        override_requested: bool = False,
        rollback_payload: Optional[Mapping[str, Any]] = None,
    ) -> MemoryAuditResult:
        payload_map = dict(payload)
        identity_map = dict(identity or {})
        timestamp = _now()
        target_id = _resolve_target_id(payload_map) or f"{action_type}:{len(self.memory_action_log) + 1}"

        prior_state = deepcopy(self._memory_state.get(target_id, {}))
        prior_text = _normalize_text(
            payload_map.get("previous_intent")
            or payload_map.get("prior_intent")
            or prior_state.get("intent")
            or prior_state.get("mission")
            or prior_state.get("execution")
        )

        new_text = ""
        for candidate in (
            payload_map.get("new_execution"),
            payload_map.get("execution"),
            payload_map.get("mission"),
            payload_map.get("intent"),
            prior_state.get("intent"),
        ):
            normalized = _normalize_text(candidate)
            if normalized:
                new_text = normalized
                break

        fingerprint = _semantic_fingerprint(prior_text, new_text)
        belief_default = prior_state.get("belief_density")
        try:
            belief_density = _coerce_float(
                payload_map.get("belief_density")
                or payload_map.get("beliefDensity")
                or payload_map.get("new_belief_density"),
                float(belief_default) if belief_default is not None else 0.0,
            )
        except ValueError:
            belief_density = float(belief_default) if belief_default is not None else 0.0

        previous_density = payload_map.get("previous_belief_density") or payload_map.get("belief_density_previous")
        if previous_density is None and belief_default is not None:
            previous_density = belief_default
        elif previous_density is None:
            previous_density = belief_density
        try:
            previous_density = _coerce_float(previous_density, belief_density)
        except ValueError:
            previous_density = belief_density
        belief_shift = round(belief_density - previous_density, 6)

        override_flag = bool(
            override_requested
            or payload_map.get("override")
            or identity_map.get("override")
            or payload_map.get("retroactive")
        )

        alignment = evaluate_alignment(
            action_type,
            payload_map,
            identity_map or None,
            override_requested=override_flag,
        )
        alignment_allowed = bool(alignment.get("allowed", True))
        decision = alignment.get("decision", "allow" if alignment_allowed else "review")
        override_granted = bool(alignment.get("override"))

        remembrance_alerts: List[Dict[str, Any]] = []
        try:
            remembrance_alerts = self.remembrance_guard.detect_forgotten_contributions([payload_map])
        except Exception:  # pragma: no cover - safety against malformed payloads
            remembrance_alerts = []

        origin_allowed = True
        origin_result: Optional[Dict[str, Any]] = None
        if self.origin_enforcer is not None:
            try:
                raw_origin = self.origin_enforcer(
                    f"audit.{action_type}",
                    manifest_path=None,
                    payload=payload_map,
                    identity=identity_map or None,
                    allow_registration=False,
                    allow_override=override_flag,
                )
                if raw_origin is not None:
                    if hasattr(raw_origin, "to_dict"):
                        origin_result = raw_origin.to_dict()
                    elif isinstance(raw_origin, Mapping):
                        origin_result = dict(raw_origin)
                    else:
                        origin_result = dict(vars(raw_origin))
                    origin_allowed = bool(origin_result.get("allowed", True))
            except Exception as exc:  # pragma: no cover - guardian failure should block action
                origin_allowed = False
                origin_result = {
                    "allowed": False,
                    "decision": "error",
                    "reasons": [str(exc)],
                }

        codex_flags: List[str] = []
        if not payload_map.get("authorized", True):
            codex_flags.append("unauthorized_memory_edit")
            alignment_allowed = False

        justification = _normalize_text(payload_map.get("justification") or payload_map.get("reason"))
        rollback_block = False

        rollback_source = rollback_payload or payload_map.get("rollback_payload") or payload_map.get("rollback")
        rollback_applied = False
        if isinstance(rollback_source, Mapping) and rollback_source:
            rollback_map = dict(rollback_source)
            if self.verify_signed_payload(rollback_map):
                rollback_applied = True
                decision = "rollback"
                snapshot = rollback_map.get("snapshot") or {}
                if isinstance(snapshot, Mapping):
                    new_text = _normalize_text(
                        snapshot.get("intent")
                        or snapshot.get("mission")
                        or snapshot.get("execution")
                        or new_text
                    )
                    fingerprint = _semantic_fingerprint(prior_text, new_text)
                    if "belief_density" in snapshot:
                        try:
                            belief_density = _coerce_float(snapshot.get("belief_density"), belief_density)
                        except ValueError:
                            pass
                    belief_shift = round(
                        belief_density
                        - _coerce_float(snapshot.get("previous_belief_density", previous_density), previous_density),
                        6,
                    )
            else:
                rollback_block = True
                codex_flags.append("invalid_rollback_signature")

        requires_justification = action_type in REQUIRES_JUSTIFICATION and not rollback_applied
        if requires_justification and not justification:
            codex_flags.append("missing_justification")

        if override_flag and not override_granted and not rollback_applied:
            codex_flags.append("override_denied")

        if action_type == "scale_authorization" and not alignment_allowed:
            codex_flags.append("misaligned_scale_attempt")

        if not alignment_allowed and not rollback_applied:
            codex_flags.append("alignment_guard_block")
        if not origin_allowed:
            codex_flags.append("origin_guard_block")

        if rollback_applied:
            allowed = origin_allowed and not rollback_block
        else:
            allowed = alignment_allowed and origin_allowed and not rollback_block

        belief_shift = round(belief_shift, 6)
        belief_density = round(belief_density, 6)
        fingerprint_drift = float(fingerprint["drift_score"])

        tags = _collect_tags(payload_map)
        identity_token = _identity_tag(identity_map)
        signature_source = json.dumps(
            {
                "action": action_type,
                "target": target_id,
                "timestamp": timestamp,
                "identity": identity_token,
                "seed": self.codex_seed,
            },
            sort_keys=True,
        )
        codex_signature = hashlib.sha256(signature_source.encode("utf-8")).hexdigest()
        audit_lock_id = f"audit-{codex_signature[:16]}"

        new_state = self._build_state(action_type, payload_map, belief_density, new_text, tags)
        if rollback_applied:
            snapshot = rollback_source.get("snapshot") if isinstance(rollback_source, Mapping) else {}
            if isinstance(snapshot, Mapping):
                new_state = dict(snapshot)

        review_required = (
            abs(belief_shift) >= self.belief_shift_threshold
            or fingerprint_drift >= self.drift_alert_threshold
            or bool(codex_flags)
            or bool(remembrance_alerts)
            or override_flag
            or not allowed
        )

        record: Dict[str, Any] = {
            "law": LAW_TITLE,
            "action_type": action_type,
            "operation": f"audit.{action_type}",
            "timestamp": timestamp,
            "target_id": target_id,
            "identity": identity_token,
            "belief_drift": fingerprint_drift,
            "belief_density_shift": belief_shift,
            "belief_density": belief_density,
            "fingerprint": fingerprint,
            "tags": tags,
            "audit_lock_id": audit_lock_id,
            "codex_signature": codex_signature,
            "allowed": allowed,
            "decision": decision,
            "override": override_granted,
            "override_requested": override_flag,
            "codex_violation_flags": codex_flags,
            "new_state": deepcopy(new_state),
            "previous_state": prior_state,
            "rollback_applied": rollback_applied,
        }

        if remembrance_alerts:
            record["remembrance_alerts"] = remembrance_alerts
        if origin_result:
            record["origin"] = origin_result
        record["alignment"] = alignment

        if review_required:
            review_payload = {
                "target_id": target_id,
                "action_type": action_type,
                "timestamp": timestamp,
                "belief_drift": fingerprint_drift,
                "belief_density_shift": belief_shift,
                "override_requested": override_flag,
                "flags": list(dict.fromkeys(codex_flags)),
            }
            record["review"] = review_payload
            self.review_queue.append(review_payload)

        self.memory_action_log.append(record)
        if allowed:
            self._memory_state[target_id] = deepcopy(new_state)

        write_json(self.audit_log_path, self.memory_action_log)

        return MemoryAuditResult(
            allowed=allowed,
            decision=decision,
            audit_lock_id=audit_lock_id,
            codex_signature=codex_signature,
            belief_drift=fingerprint_drift,
            belief_density_shift=belief_shift,
            codex_violation_flags=list(dict.fromkeys(codex_flags)),
            review_enqueued=review_required,
            record=record,
        )

    # ------------------------------------------------------------------
    # State & replay helpers
    # ------------------------------------------------------------------
    def _build_state(
        self,
        action_type: str,
        payload: Mapping[str, Any],
        belief_density: float,
        normalized_intent: str,
        tags: Sequence[str],
    ) -> Dict[str, Any]:
        state: Dict[str, Any] = {"belief_density": round(belief_density, 6)}
        if tags:
            state["tags"] = list(tags)

        if action_type in {"mission_change", "retroactive_change", "rollback"}:
            for key in ("mission", "intent", "execution", "new_execution"):
                value = payload.get(key)
                if value:
                    state[key] = value
            if normalized_intent and "intent" not in state:
                state["intent"] = normalized_intent
        if action_type == "contributor_reclassification":
            for key in ("contributor", "user", "identity", "role", "tier", "new_role", "new_tier"):
                value = payload.get(key)
                if value:
                    state[key] = value
        if action_type == "scale_authorization":
            for key in ("scale", "scale_level", "scale_authorization", "capacity", "mission"):
                value = payload.get(key)
                if value:
                    state[key] = value
        return state

    def get_state(self, target_id: str) -> Dict[str, Any]:
        state = self._memory_state.get(target_id)
        return deepcopy(state) if state else {}

    def replay_audit_log(self, records: Optional[Sequence[Mapping[str, Any]]] = None) -> Dict[str, Any]:
        entries = list(records) if records is not None else self.memory_action_log
        missions: Dict[str, Dict[str, Any]] = {}
        contributors: Dict[str, Dict[str, Any]] = {}
        scales: Dict[str, Dict[str, Any]] = {}
        rollbacks: List[Dict[str, Any]] = []
        history: Dict[str, List[Dict[str, Any]]] = {}

        for entry in entries:
            if not isinstance(entry, Mapping):
                continue
            target_id = entry.get("target_id")
            if not isinstance(target_id, str):
                continue
            history.setdefault(target_id, []).append(dict(entry))
            action_type = entry.get("action_type")
            state = entry.get("new_state")
            if not isinstance(state, Mapping):
                continue
            state_copy = dict(state)
            if action_type == "mission_change":
                missions[target_id] = state_copy
            elif action_type == "contributor_reclassification":
                contributors[target_id] = state_copy
            elif action_type == "scale_authorization":
                scales[target_id] = state_copy
            elif action_type in {"retroactive_change", "rollback"}:
                missions[target_id] = state_copy
                rollbacks.append(
                    {
                        "target_id": target_id,
                        "timestamp": entry.get("timestamp"),
                        "restored_state": state_copy,
                    }
                )

        return {
            "missions": missions,
            "contributors": contributors,
            "scales": scales,
            "rollbacks": rollbacks,
            "history": history,
        }


__all__ = [
    "LAW_TITLE",
    "MEMORY_AUDIT_LOG_PATH",
    "MemoryAuditGuard",
    "MemoryAuditResult",
]

