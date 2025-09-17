"""Vaultfire Law 9: Resistance Override Protocol."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, MutableMapping, Optional, Sequence

from utils.json_io import load_json

from .human_standard_guard import DEFAULT_HUMAN_STANDARD_GUARD, HumanStandardGuard

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_LOG_DIR = BASE_DIR / "logs"
DEFAULT_AUDIT_PATH = DEFAULT_LOG_DIR / "resistance_override_log.jsonl"
DEFAULT_EVENT_PATH = DEFAULT_LOG_DIR / "resistance_override_events.jsonl"
DEFAULT_PARTNERS_PATH = BASE_DIR / "partners.json"
DEFAULT_CONTRIBUTOR_REGISTRY_PATH = BASE_DIR / "contributor_registry.json"
DEFAULT_SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
DEFAULT_ALIGNMENT_LOG_PATH = DEFAULT_LOG_DIR / "belief_trace_log.json"

ALLOWED_POLICY_MARKERS = {
    "architect-only",
    "architect",
    "codex-approved",
    "lawful-rollback",
    "rollback",
    "recovery",
}
PROTECTED_PATHWAYS = {"memory", "alignment", "audit"}


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def _normalize(value: Optional[str]) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip().lower()


def _coerce_mapping(data: Any) -> MutableMapping[str, Any]:
    if isinstance(data, MutableMapping):
        return data
    if isinstance(data, Mapping):
        return dict(data)
    return {}


def _iter_strings(items: Iterable[Any]) -> Iterable[str]:
    for item in items:
        if isinstance(item, str) and item.strip():
            yield item.strip()


@dataclass(frozen=True)
class ResistanceOverrideDecision:
    """Envelope describing the outcome of a resistance override review."""

    allowed: bool
    reason: str
    override_requested: bool
    record: Dict[str, Any]
    audit_entry: Dict[str, Any] | None = None
    rejection_event: Dict[str, Any] | None = None

    @property
    def reasons(self) -> Sequence[str]:
        reasons = self.record.get("reasons", [])
        if isinstance(reasons, Sequence):
            return tuple(reasons)
        return ()


class ResistanceOverrideGuard:
    """Guard that blocks unauthorized override attempts across Vaultfire."""

    def __init__(
        self,
        *,
        base_dir: str | Path | None = None,
        audit_log_path: str | Path | None = None,
        event_log_path: str | Path | None = None,
        partners_path: str | Path | None = None,
        contributor_registry_path: str | Path | None = None,
        scorecard_path: str | Path | None = None,
        alignment_log_path: str | Path | None = None,
        human_guard: HumanStandardGuard | None = None,
    ) -> None:
        self.base_dir = Path(base_dir) if base_dir is not None else BASE_DIR
        self.audit_log_path = Path(audit_log_path) if audit_log_path else DEFAULT_AUDIT_PATH
        self.event_log_path = Path(event_log_path) if event_log_path else DEFAULT_EVENT_PATH
        self.partners_path = Path(partners_path) if partners_path else DEFAULT_PARTNERS_PATH
        self.contributor_registry_path = (
            Path(contributor_registry_path)
            if contributor_registry_path
            else DEFAULT_CONTRIBUTOR_REGISTRY_PATH
        )
        self.scorecard_path = Path(scorecard_path) if scorecard_path else DEFAULT_SCORECARD_PATH
        self.alignment_log_path = (
            Path(alignment_log_path) if alignment_log_path else DEFAULT_ALIGNMENT_LOG_PATH
        )
        self.human_guard = human_guard or DEFAULT_HUMAN_STANDARD_GUARD

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def validate(
        self,
        operation: str,
        caller_id: str,
        override_payload: Mapping[str, Any] | None = None,
        *,
        context: Mapping[str, Any] | None = None,
    ) -> ResistanceOverrideDecision:
        override_map = _coerce_mapping(override_payload)
        context_map = _coerce_mapping(context)
        timestamp = _now()
        mission_type = self._resolve_mission_type(operation, override_map, context_map)
        mission_policy = self._resolve_mission_policy(override_map, context_map)
        signature = self._resolve_signature(override_map, context_map)
        override_requested = self._resolve_override_flag(override_map, context_map)

        lineage = self._lookup_lineage(caller_id, override_map, context_map)
        architect_authorized = self._is_architect(caller_id, lineage, override_map, context_map)
        alignment_clear, alignment_reason = self._alignment_clear(caller_id)

        reasons: list[str] = []
        if not architect_authorized:
            reasons.append("insufficient_clearance")

        if not signature:
            reasons.append("missing_codex_signature")
        elif not self._signature_valid(signature):
            reasons.append("invalid_codex_signature")

        if not lineage.get("verified"):
            reasons.append("lineage_not_verified")
        elif lineage.get("trust_tier") != "architect":
            reasons.append("non_architect_lineage")

        if mission_type in PROTECTED_PATHWAYS:
            reasons.append("protected_pathway")

        if not self._mission_allowed(mission_type, mission_policy, override_map, context_map):
            reasons.append("mission_policy_block")

        if not alignment_clear:
            reasons.append(alignment_reason or "alignment_block")

        allowed = not reasons
        reason_text = reasons[0] if reasons else "allowed"

        provenance_hash = self._fingerprint(
            caller_id,
            signature or "",
            mission_type,
            mission_policy or "",
            timestamp,
            operation,
        )

        record: Dict[str, Any] = {
            "timestamp": timestamp,
            "operation": operation,
            "caller_id": caller_id,
            "mission_type": mission_type,
            "mission_policy": mission_policy,
            "override_requested": override_requested,
            "codex_signature_present": bool(signature),
            "lineage_verified": bool(lineage.get("verified")),
            "lineage_trust_tier": lineage.get("trust_tier"),
            "architect_authorized": architect_authorized,
            "alignment_clear": alignment_clear,
            "reasons": reasons if reasons else ["allowed"],
            "provenance_hash": provenance_hash,
            "status": "allowed" if allowed else "rejected",
        }

        if signature:
            record["codex_signature_digest"] = hashlib.sha256(signature.encode("utf-8")).hexdigest()
        if lineage.get("record"):
            record["lineage_record"] = lineage["record"]

        human_payload = dict(override_map)
        human_payload.setdefault("mission_type", mission_type)
        if mission_policy is not None:
            human_payload.setdefault("mission_policy", mission_policy)
        human_payload["override_requested"] = override_requested
        human_payload["pre_guard_allowed"] = allowed
        human_context = {
            "alignment_clear": alignment_clear,
            "alignment_reason": alignment_reason,
            "reasons": list(reasons),
            "allowed_pre_guard": allowed,
            "mission": mission_type in {"growth", "memory", "audit"},
        }
        empathy_candidates = [
            override_map.get("empathy_score"),
            override_map.get("empathyScore"),
            context_map.get("empathy_score"),
            context_map.get("empathyScore"),
        ]
        lineage_record = lineage.get("record")
        if isinstance(lineage_record, Mapping):
            empathy_candidates.extend(
                [
                    lineage_record.get("empathy_score"),
                    lineage_record.get("empathyScore"),
                ]
            )
        empathy_value = None
        for candidate in empathy_candidates:
            if candidate is None:
                continue
            try:
                empathy_value = float(candidate)
            except (TypeError, ValueError):
                continue
            else:
                break
        if empathy_value is None:
            empathy_value = 0.82 if architect_authorized and alignment_clear else 0.68 if alignment_clear else 0.6
        human_payload.setdefault("empathy_score", empathy_value)
        human_identity: Dict[str, Any] = {}
        if isinstance(lineage.get("record"), Mapping):
            human_identity.update(dict(lineage.get("record")))
        human_identity.setdefault("caller_id", caller_id)
        if lineage.get("trust_tier"):
            human_identity.setdefault("trust_tier", lineage.get("trust_tier"))
        human_identity.setdefault("empathy_score", empathy_value)
        human_standard_result = self.human_guard.evaluate(
            operation,
            human_payload,
            identity=human_identity,
            context=human_context,
            initial_decision=allowed,
        )
        record["human_standard"] = human_standard_result["audit_record"]
        record["human_standard_hash"] = human_standard_result["human_standard_hash"]
        record["human_standard_escalation"] = human_standard_result["escalation_level"]
        record["human_standard_reasons"] = human_standard_result["reasons"]
        record["ethics_versions"] = human_standard_result["ethics_versions"]
        record["passive_empathy_synced"] = human_standard_result["passive_empathy_synced"]
        if not human_standard_result["allowed"]:
            allowed = False
            for item in human_standard_result["reasons"] or ["human_standard_violation"]:
                if item not in reasons:
                    reasons.append(item)
            record["status"] = "rejected"
        record["allowed"] = allowed
        reason_text = reasons[0] if reasons else ("allowed" if allowed else "human_standard_violation")
        record["reasons"] = reasons if reasons else (["allowed"] if allowed else ["human_standard_violation"])

        audit_entry = self._append_log_entry(self.audit_log_path, record)
        event_entry: Dict[str, Any] | None = None
        if not allowed:
            event_payload = {
                "event": "override_rejection_event",
                "timestamp": timestamp,
                "operation": operation,
                "caller_id": caller_id,
                "mission_type": mission_type,
                "reasons": list(reasons),
                "provenance_hash": provenance_hash,
                "audit_hash": audit_entry.get("hash"),
                "human_standard_hash": human_standard_result["human_standard_hash"],
            }
            event_entry = self._append_log_entry(self.event_log_path, event_payload)

        return ResistanceOverrideDecision(
            allowed=allowed,
            reason=reason_text,
            override_requested=override_requested,
            record=record,
            audit_entry=audit_entry,
            rejection_event=event_entry,
        )

    # ------------------------------------------------------------------
    # Logging helpers
    # ------------------------------------------------------------------
    def load_audit_log(self) -> list[Dict[str, Any]]:
        return self._read_log(self.audit_log_path)

    def load_event_log(self) -> list[Dict[str, Any]]:
        return self._read_log(self.event_log_path)

    def _read_log(self, path: Path) -> list[Dict[str, Any]]:
        if not path.exists():
            return []
        entries: list[Dict[str, Any]] = []
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, Mapping):
                entries.append(dict(parsed))
        return entries

    def _append_log_entry(self, path: Path, payload: Mapping[str, Any]) -> Dict[str, Any]:
        data = dict(payload)
        path.parent.mkdir(parents=True, exist_ok=True)
        prev_hash = self._load_last_hash(path)
        data["prev_hash"] = prev_hash
        encoded = json.dumps(data, sort_keys=True)
        data["hash"] = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(data) + "\n")
        return data

    def _load_last_hash(self, path: Path) -> str:
        if not path.exists():
            return "0" * 64
        try:
            with path.open("rb") as handle:
                handle.seek(0, 2)
                if handle.tell() == 0:
                    return "0" * 64
                handle.seek(-2, 2)
                while handle.tell() > 0 and handle.read(1) != b"\n":
                    handle.seek(-2, 1)
                last_line = handle.readline().decode("utf-8").strip()
            if not last_line:
                return "0" * 64
            parsed = json.loads(last_line)
            if isinstance(parsed, Mapping):
                hash_value = parsed.get("hash")
                if isinstance(hash_value, str) and len(hash_value) == 64:
                    return hash_value
        except Exception:
            return "0" * 64
        return "0" * 64

    # ------------------------------------------------------------------
    # Decision helpers
    # ------------------------------------------------------------------
    def _resolve_override_flag(
        self,
        payload: Mapping[str, Any],
        context: Mapping[str, Any],
    ) -> bool:
        override_keys = (
            "override",
            "override_requested",
            "force_override",
            "overrideRequested",
        )
        for key in override_keys:
            value = payload.get(key)
            if isinstance(value, bool) and value:
                return True
            if isinstance(value, str) and value.strip().lower() in {"true", "yes", "architect"}:
                return True
        for key in override_keys:
            value = context.get(key)
            if isinstance(value, bool) and value:
                return True
            if isinstance(value, str) and value.strip().lower() in {"true", "yes", "architect"}:
                return True
        if context.get("allow_registration"):
            return True
        return False

    def _resolve_signature(
        self,
        payload: Mapping[str, Any],
        context: Mapping[str, Any],
    ) -> Optional[str]:
        keys = (
            "codex_signature",
            "override_signature",
            "belief_signature",
            "beliefSignature",
            "signature",
        )
        for source in (payload, context):
            for key in keys:
                value = source.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        rollback = payload.get("rollback_payload")
        if isinstance(rollback, Mapping):
            signature = rollback.get("signature")
            if isinstance(signature, str) and signature.strip():
                return signature.strip()
        return None

    def _signature_valid(self, signature: str) -> bool:
        normalized = signature.strip()
        if len(normalized) < 32:
            return False
        try:
            int(normalized, 16)
            return True
        except ValueError:
            return len(normalized) >= 44

    def _resolve_mission_type(
        self,
        operation: str,
        payload: Mapping[str, Any],
        context: Mapping[str, Any],
    ) -> str:
        for source in (payload, context):
            for key in ("mission_type", "missionType", "pathway", "channel", "scope"):
                value = source.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip().lower()
        operation_lower = operation.lower()
        if "rollback" in operation_lower:
            return "rollback"
        if "register" in operation_lower or "origin" in operation_lower:
            return "registration"
        if "mission" in operation_lower or "growth" in operation_lower:
            return "growth"
        if "memory" in operation_lower:
            return "memory"
        if "audit" in operation_lower:
            return "audit"
        return "general"

    def _resolve_mission_policy(
        self,
        payload: Mapping[str, Any],
        context: Mapping[str, Any],
    ) -> Optional[str]:
        for source in (payload, context):
            for key in (
                "mission_policy",
                "missionPolicy",
                "policy",
                "override_policy",
                "overridePolicy",
            ):
                value = source.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip().lower()
        return None

    def _mission_allowed(
        self,
        mission_type: str,
        mission_policy: Optional[str],
        payload: Mapping[str, Any],
        context: Mapping[str, Any],
    ) -> bool:
        if mission_type in PROTECTED_PATHWAYS:
            return False
        if mission_type == "rollback":
            return True
        if mission_type == "registration":
            policy = mission_policy or context.get("policy") or payload.get("policy")
            if isinstance(policy, str) and policy.strip().lower() in ALLOWED_POLICY_MARKERS:
                return True
            return False
        if mission_policy and mission_policy in ALLOWED_POLICY_MARKERS:
            return True
        return False

    def _lookup_lineage(
        self,
        caller_id: str,
        payload: Mapping[str, Any],
        context: Mapping[str, Any],
    ) -> Dict[str, Any]:
        normalized = _normalize(caller_id)
        registry = load_json(self.contributor_registry_path, {})
        record: Dict[str, Any] | None = None
        if isinstance(registry, Mapping):
            for key, value in registry.items():
                if not isinstance(value, Mapping):
                    continue
                candidates = { _normalize(key) }
                for field in ("identity", "ens", "wallet", "handle", "id", "origin_id"):
                    entry_value = value.get(field)
                    if isinstance(entry_value, str):
                        candidates.add(_normalize(entry_value))
                if normalized and normalized in candidates:
                    record = dict(value)
                    break
        if record is None:
            record = {}
        trust_markers: set[str] = set()
        for key in ("trust_tier", "trustTier", "role", "title", "tier"):
            value = record.get(key)
            if isinstance(value, str) and value.strip():
                trust_markers.add(value.strip().lower())
        tags = record.get("tags")
        if isinstance(tags, Iterable) and not isinstance(tags, (str, bytes)):
            trust_markers.update(tag.strip().lower() for tag in tags if isinstance(tag, str))
        trust_tier = "architect" if any("architect" in marker for marker in trust_markers) else None
        if not trust_tier:
            trust_tier = next(iter(trust_markers), "")
        verified = bool(record)
        if not verified:
            partner_info = self._lookup_partner(caller_id)
            if partner_info is not None:
                record = partner_info
                verified = True
                trust_value = record.get("role") or record.get("title")
                if isinstance(trust_value, str) and "architect" in trust_value.lower():
                    trust_tier = "architect"
        return {
            "verified": verified,
            "record": record,
            "trust_tier": trust_tier or "",
        }

    def _lookup_partner(self, caller_id: str) -> Dict[str, Any] | None:
        partners = load_json(self.partners_path, [])
        normalized = _normalize(caller_id)
        if not isinstance(partners, Iterable):
            return None
        for entry in partners:
            if not isinstance(entry, Mapping):
                continue
            candidates = set(
                _normalize(value)
                for value in (
                    entry.get("partner_id"),
                    entry.get("wallet"),
                    entry.get("ens"),
                    entry.get("id"),
                )
                if isinstance(value, str)
            )
            if normalized and normalized in candidates:
                return dict(entry)
        return None

    def _is_architect(
        self,
        caller_id: str,
        lineage: Mapping[str, Any],
        payload: Mapping[str, Any],
        context: Mapping[str, Any],
    ) -> bool:
        normalized = _normalize(caller_id)
        if not normalized:
            return False
        trust_tier = lineage.get("trust_tier")
        if isinstance(trust_tier, str) and trust_tier == "architect":
            return True
        record = lineage.get("record")
        if isinstance(record, Mapping):
            for key in ("role", "title", "contributor_tag"):
                value = record.get(key)
                if isinstance(value, str) and "architect" in value.lower():
                    return True
            tags = record.get("tags")
            if isinstance(tags, Iterable) and not isinstance(tags, (str, bytes)):
                if any("architect" in tag.lower() for tag in _iter_strings(tags)):
                    return True
        scorecard = load_json(self.scorecard_path, {})
        if isinstance(scorecard, Mapping):
            candidate = scorecard.get(caller_id) or scorecard.get(normalized)
            if isinstance(candidate, Mapping):
                tag = candidate.get("contributor_tag") or candidate.get("role")
                if isinstance(tag, str) and "architect" in tag.lower():
                    return True
        for source in (payload, context):
            tier_value = source.get("trust_tier") or source.get("trustTier") or source.get("role")
            if isinstance(tier_value, str) and "architect" in tier_value.lower():
                return True
        return False

    def _alignment_clear(self, caller_id: str) -> tuple[bool, Optional[str]]:
        history = load_json(self.alignment_log_path, [])
        normalized = _normalize(caller_id)
        if not isinstance(history, Iterable):
            return True, None
        for entry in reversed(list(history)[-25:]):
            if not isinstance(entry, Mapping):
                continue
            candidates = []
            for key in ("identity", "identity_tag", "identityToken", "user_id", "wallet", "ens"):
                value = entry.get(key)
                if isinstance(value, str):
                    candidates.append(_normalize(value))
            if normalized and normalized in candidates:
                decision = entry.get("decision")
                allowed = entry.get("allowed")
                if isinstance(decision, str) and decision.lower() in {"block", "deny"}:
                    return False, "moral_alignment_block"
                if allowed is False:
                    return False, "moral_alignment_block"
        return True, None

    def _fingerprint(
        self,
        caller_id: str,
        signature: str,
        mission_type: str,
        mission_policy: str,
        timestamp: str,
        operation: str,
    ) -> str:
        payload = json.dumps(
            {
                "caller": _normalize(caller_id),
                "signature_tail": signature[-16:],
                "mission_type": mission_type,
                "mission_policy": mission_policy,
                "timestamp": timestamp,
                "operation": operation,
            },
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


DEFAULT_RESISTANCE_GUARD = ResistanceOverrideGuard()

__all__ = [
    "ResistanceOverrideGuard",
    "ResistanceOverrideDecision",
    "DEFAULT_RESISTANCE_GUARD",
]
