"""Vaultfire Law 7 – Origin Integrity Directive.

This module protects Vaultfire lineage by enforcing origin authenticity for
mission manifests, belief files, and protocol forks.  It records immutable
origin hashes, validates contributor claims against codex trust markers, and
applies tamper-evident signatures to critical files.  The guard collaborates
with :mod:`engine.alignment_guard` to ensure morally divergent forks are
blocked even when origin credentials appear valid.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, MutableMapping, Optional

from .alignment_guard import evaluate_alignment
from .identity_resolver import resolve_identity
from .resistance_override_guard import ResistanceOverrideDecision, ResistanceOverrideGuard
from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parents[1]
REGISTRY_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "origin_registry.json"
LOG_PATH = BASE_DIR / "logs" / "origin_guard_log.json"
CODEX_MANIFEST_PATH = BASE_DIR / "codex_manifest.json"
CONTRIBUTOR_REGISTRY_PATH = BASE_DIR / "contributor_registry.json"

MIN_TRUST_SCORE = 0.75
ARCHITECT_TIERS = {
    "architect",
    "architect-tier",
    "architect_level",
    "architects",
    "guardian",
}
SIGNABLE_SUFFIXES = (".manifest", ".belief.json")

REASON_ORIGIN_MISSING = "origin_identity_missing"
REASON_ORIGIN_NOT_VERIFIED = "origin_not_verified"
REASON_ORIGIN_NOT_REGISTERED = "origin_not_registered"
REASON_ORIGIN_CONFLICT = "origin_identity_conflict"
REASON_HASH_MISMATCH = "origin_hash_mismatch"
REASON_ALIGNMENT_BLOCK = "alignment_guard_blocked"


def _build_resistance_override_guard() -> ResistanceOverrideGuard:
    log_dir = LOG_PATH.parent if LOG_PATH else BASE_DIR / "logs"
    return ResistanceOverrideGuard(
        audit_log_path=log_dir / "resistance_override_log.jsonl",
        event_log_path=log_dir / "resistance_override_events.jsonl",
        contributor_registry_path=CONTRIBUTOR_REGISTRY_PATH,
        partners_path=BASE_DIR / "partners.json",
        scorecard_path=BASE_DIR / "user_scorecard.json",
    )


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def _normalize(value: str) -> str:
    return value.strip().lower()


def _manifest_key(manifest_path: Optional[Path], payload: Mapping[str, Any]) -> str:
    keys = (
        "manifest_key",
        "manifest_id",
        "manifestId",
        "mission_id",
        "missionId",
        "protocol_id",
        "protocolId",
        "id",
    )
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    if manifest_path is not None:
        try:
            return manifest_path.resolve().relative_to(BASE_DIR).as_posix()
        except ValueError:
            return manifest_path.resolve().as_posix()
    return "unscoped-origin"


def _read_bytes_for_hash(manifest_path: Optional[Path], payload: Mapping[str, Any]) -> bytes:
    if manifest_path is not None and manifest_path.exists():
        return manifest_path.read_bytes()
    try:
        return json.dumps(payload, sort_keys=True).encode("utf-8")
    except TypeError:
        return str(payload).encode("utf-8")


def _compute_origin_hash(manifest_path: Optional[Path], payload: Mapping[str, Any]) -> str:
    data = _read_bytes_for_hash(manifest_path, payload)
    return hashlib.sha256(data).hexdigest()


def _should_sign_file(manifest_path: Optional[Path]) -> bool:
    if manifest_path is None:
        return False
    name = manifest_path.name.lower()
    return any(name.endswith(suffix) for suffix in SIGNABLE_SUFFIXES)


def _signature_path(manifest_path: Path) -> Path:
    return manifest_path.parent / f"{manifest_path.name}.sig"


def _load_registry() -> Dict[str, Any]:
    data = load_json(REGISTRY_PATH, {})
    if not isinstance(data, dict):
        data = {}
    data.setdefault("entries", {})
    data.setdefault("contributors", {})
    return data


def _write_registry(data: Mapping[str, Any]) -> None:
    write_json(REGISTRY_PATH, data)


def _append_log(entry: Mapping[str, Any]) -> None:
    log = load_json(LOG_PATH, [])
    if not isinstance(log, list):
        log = []
    log.append(dict(entry))
    if len(log) > 200:
        log = log[-200:]
    write_json(LOG_PATH, log)


def _load_contributor_index() -> Dict[str, Dict[str, Any]]:
    raw = load_json(CONTRIBUTOR_REGISTRY_PATH, {})
    index: Dict[str, Dict[str, Any]] = {}
    if not isinstance(raw, Mapping):
        return index
    for wallet, record in raw.items():
        if not isinstance(record, Mapping):
            continue
        candidates = {str(wallet)}
        for key in ("ens", "identity", "handle", "wallet"):
            value = record.get(key)
            if isinstance(value, str) and value.strip():
                candidates.add(value)
        for candidate in candidates:
            index[_normalize(candidate)] = {
                "wallet": wallet,
                "record": dict(record),
            }
    return index


def _add_codex_entry(
    index: MutableMapping[str, Dict[str, Any]],
    source_id: str,
    record: Mapping[str, Any],
    trust_score: Any,
) -> None:
    identifiers: list[str] = []
    for key in ("ens", "wallet", "identity", "id", "fingerprint", "name"):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            identifiers.append(value)
    for identifier in identifiers:
        index[_normalize(identifier)] = {
            "source": source_id,
            "data": dict(record),
            "trust_score": trust_score,
        }


def _load_codex_index() -> Dict[str, Dict[str, Any]]:
    raw = load_json(CODEX_MANIFEST_PATH, {})
    index: Dict[str, Dict[str, Any]] = {}
    if not isinstance(raw, Mapping):
        return index

    def _score_from(value: Any) -> Optional[float]:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    for law in raw.get("universal_laws", []) or []:
        if not isinstance(law, Mapping):
            continue
        originator = law.get("originator")
        if isinstance(originator, Mapping):
            _add_codex_entry(
                index,
                str(law.get("id") or law.get("title") or "codex-law"),
                originator,
                _score_from(law.get("trust_score")),
            )
    for contributor in raw.get("contributors", []) or []:
        if not isinstance(contributor, Mapping):
            continue
        _add_codex_entry(
            index,
            str(contributor.get("id") or contributor.get("ens") or contributor.get("wallet") or "codex-contributor"),
            contributor,
            _score_from(
                contributor.get("trust_score")
                or contributor.get("trustScore")
                or contributor.get("score")
            ),
        )
    codex_trust = raw.get("trust")
    if isinstance(codex_trust, Mapping):
        for key, record in codex_trust.items():
            if isinstance(record, Mapping):
                _add_codex_entry(
                    index,
                    str(key),
                    record,
                    _score_from(record.get("trust_score") or record.get("score")),
                )
    return index


def _normalize_score(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    if score < 0:
        return 0.0
    if score > 1.0:
        if score <= 100.0:
            score = score / 100.0
        else:
            score = 1.0
    return round(min(score, 1.0), 3)


def _extract_trust_score(*sources: Mapping[str, Any]) -> Optional[float]:
    keys = (
        "codex_trust",
        "codexTrust",
        "trust_score",
        "trustScore",
        "belief_trust",
        "beliefTrust",
    )
    for source in sources:
        for key in keys:
            value = source.get(key)
            if value is None:
                continue
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
    return None


def _extract_trust_tier(*sources: Mapping[str, Any]) -> Optional[str]:
    keys = ("trust_tier", "trustTier", "role", "tier", "authority_level")
    for source in sources:
        for key in keys:
            value = source.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip().lower()
    return None


def _resolve_origin_identity(payload: Mapping[str, Any], identity: Mapping[str, Any]) -> Optional[str]:
    keys = (
        "origin_id",
        "originId",
        "origin",
        "ens",
        "wallet",
        "address",
        "fingerprint",
        "codex_fingerprint",
        "owner",
        "author",
    )
    for source in (identity, payload):
        for key in keys:
            value = source.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def _resolve_trust_marker(
    origin_id: Optional[str],
    payload: Mapping[str, Any],
    identity: Mapping[str, Any],
) -> Dict[str, Any]:
    trust: Dict[str, Any] = {
        "origin_id": origin_id,
        "marker": "unverified",
        "verified": False,
        "sources": [],
        "score": 0.0,
        "tier": _extract_trust_tier(identity, payload),
    }
    if not origin_id:
        return trust

    origin_key = _normalize(origin_id)
    sources: list[str] = []
    resolved_addresses: list[str] = []

    ens_candidate = None
    for source in (identity, payload):
        candidate = source.get("ens")
        if isinstance(candidate, str) and candidate.strip():
            ens_candidate = candidate.strip()
            break
    if ens_candidate is None and origin_id.lower().endswith(".eth"):
        ens_candidate = origin_id
    if ens_candidate:
        resolved = resolve_identity(ens_candidate)
        if resolved:
            sources.append("ens")
            resolved_addresses.append(resolved)

    for source in (identity, payload):
        candidate = source.get("wallet") or source.get("address")
        if isinstance(candidate, str) and candidate.strip():
            resolved_addresses.append(candidate.strip())

    contributor_index = _load_contributor_index()
    registry_record: Optional[Mapping[str, Any]] = None
    if origin_key in contributor_index:
        sources.append("registry")
        registry_record = contributor_index[origin_key]["record"]
        trust["registry_record"] = dict(registry_record)
        trust["marker"] = f"registry:{contributor_index[origin_key]['wallet']}"
    else:
        for candidate in resolved_addresses:
            normalized = _normalize(candidate)
            if normalized in contributor_index:
                sources.append("registry")
                registry_record = contributor_index[normalized]["record"]
                trust["registry_record"] = dict(registry_record)
                trust["marker"] = f"registry:{contributor_index[normalized]['wallet']}"
                break

    codex_index = _load_codex_index()
    codex_record: Optional[Mapping[str, Any]] = None
    if origin_key in codex_index:
        sources.append("codex")
        codex_entry = codex_index[origin_key]
        codex_record = codex_entry.get("data") or {}
        trust["codex_record"] = dict(codex_record)
        trust_score = codex_entry.get("trust_score")
        if trust_score is not None:
            trust["score"] = max(trust["score"], _normalize_score(trust_score))
        trust["marker"] = f"codex:{codex_entry.get('source')}"
    else:
        for candidate in resolved_addresses:
            normalized = _normalize(candidate)
            if normalized in codex_index:
                sources.append("codex")
                codex_entry = codex_index[normalized]
                codex_record = codex_entry.get("data") or {}
                trust["codex_record"] = dict(codex_record)
                trust_score = codex_entry.get("trust_score")
                if trust_score is not None:
                    trust["score"] = max(trust["score"], _normalize_score(trust_score))
                trust["marker"] = f"codex:{codex_entry.get('source')}"
                break

    identity_score = _extract_trust_score(identity, payload)
    if identity_score is not None:
        trust["score"] = max(trust["score"], _normalize_score(identity_score))

    if resolved_addresses:
        trust["address"] = resolved_addresses[0]

    trust["sources"] = sorted(set(sources))
    verified = bool(trust["sources"])
    if "codex" in trust["sources"] and trust["score"] < MIN_TRUST_SCORE:
        verified = False
    trust["verified"] = verified
    if trust["marker"] == "unverified" and trust["sources"]:
        priority = {
            "codex": 3,
            "registry": 2,
            "ens": 1,
        }
        best_marker = None
        best_rank = 0
        if registry_record:
            best_marker = f"registry:{registry_record.get('ens') or registry_record.get('identity') or origin_id}"
            best_rank = priority["registry"]
        if codex_record:
            codex_marker = codex_record.get("ens") or codex_record.get("wallet") or codex_record.get("name")
            best_marker = f"codex:{codex_marker or origin_id}"
            best_rank = priority["codex"]
        if "ens" in trust["sources"] and best_rank < priority["ens"]:
            best_marker = f"ens:{ens_candidate.lower() if ens_candidate else origin_id.lower()}"
        if best_marker:
            trust["marker"] = best_marker
    return trust


def _can_override(identity: Mapping[str, Any], payload: Mapping[str, Any], trust: Mapping[str, Any]) -> bool:
    tier = trust.get("tier") or _extract_trust_tier(identity, payload)
    if not isinstance(tier, str) or tier.lower() not in ARCHITECT_TIERS:
        return False
    proof_keys = (
        "proof_of_authorship",
        "auth_signature",
        "origin_signature",
        "origin_proof",
        "architect_signature",
    )
    proof = None
    for source in (identity, payload):
        for key in proof_keys:
            value = source.get(key)
            if isinstance(value, str) and value.strip():
                proof = value.strip()
                break
        if proof:
            break
    if not proof or len(proof) < 12:
        return False
    return bool(trust.get("verified"))


def _build_origin_stamp(base: Mapping[str, Any]) -> Dict[str, Any]:
    payload = dict(base)
    stamp_source = json.dumps(payload, sort_keys=True).encode("utf-8")
    payload["signature"] = hashlib.sha256(stamp_source).hexdigest()
    return payload


def _persist_signature(manifest_path: Path, stamp: Mapping[str, Any]) -> None:
    if not _should_sign_file(manifest_path):
        return
    sig_path = _signature_path(manifest_path)
    write_json(sig_path, stamp)


@dataclass
class OriginGuardResult:
    allowed: bool
    decision: str
    reasons: list[str]
    origin_stamp: Optional[Dict[str, Any]]
    alignment: Dict[str, Any]
    trust: Dict[str, Any]
    override: bool
    manifest_key: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "allowed": self.allowed,
            "decision": self.decision,
            "reasons": list(self.reasons),
            "origin_stamp": self.origin_stamp,
            "alignment": self.alignment,
            "trust": self.trust,
            "override": self.override,
            "manifest_key": self.manifest_key,
        }


def enforce_origin(
    operation: str,
    *,
    manifest_path: Optional[Path | str] = None,
    payload: Optional[Mapping[str, Any]] = None,
    identity: Optional[Mapping[str, Any]] = None,
    allow_registration: bool = False,
    allow_override: bool = False,
) -> OriginGuardResult:
    payload_map: Dict[str, Any] = dict(payload or {})
    identity_map: Dict[str, Any] = dict(identity or {})
    manifest_obj = Path(manifest_path) if isinstance(manifest_path, (str, Path)) else None

    origin_id = _resolve_origin_identity(payload_map, identity_map)
    reasons: list[str] = []
    if not origin_id:
        reasons.append(REASON_ORIGIN_MISSING)

    trust = _resolve_trust_marker(origin_id, payload_map, identity_map)
    if origin_id and not trust.get("verified", False):
        reasons.append(REASON_ORIGIN_NOT_VERIFIED)

    manifest_key = _manifest_key(manifest_obj, payload_map)
    file_hash = _compute_origin_hash(manifest_obj, payload_map)
    registry = _load_registry()
    entries: Dict[str, Any] = registry["entries"]
    contributors: Dict[str, Any] = registry["contributors"]
    entry = entries.get(manifest_key)

    origin_key = _normalize(origin_id) if origin_id else None
    override_requested = bool(allow_override or identity_map.get("override") or payload_map.get("override"))
    resistance_decision: ResistanceOverrideDecision | None = None
    if allow_registration or override_requested:
        guard_payload: Dict[str, Any] = dict(payload_map)
        guard_payload["override"] = True
        guard_payload.setdefault("mission_type", "registration" if allow_registration else "origin")
        guard_payload.setdefault(
            "codex_signature",
            guard_payload.get("codex_signature")
            or guard_payload.get("override_signature")
            or guard_payload.get("belief_signature")
            or guard_payload.get("beliefSignature"),
        )
        if allow_registration:
            policy_value = (
                guard_payload.get("mission_policy")
                or guard_payload.get("policy")
                or "architect-only"
            )
            guard_payload["mission_policy"] = str(policy_value)
        guard_context = {
            "pathway": "contributor_registration" if allow_registration else "origin_override",
            "allow_registration": allow_registration,
        }
        caller_reference = (
            identity_map.get("override_caller")
            or payload_map.get("override_caller")
            or identity_map.get("ens")
            or identity_map.get("wallet")
            or identity_map.get("user_id")
            or origin_id
            or manifest_key
        )
        caller_reference = str(caller_reference or "unknown")
        resistance_decision = _build_resistance_override_guard().validate(
            operation,
            caller_reference,
            override_payload=guard_payload,
            context=guard_context,
        )
        if not resistance_decision.allowed:
            reasons.append(resistance_decision.reason)

    override_granted = False

    if entry is None:
        if allow_registration and not reasons:
            entry = {
                "origin_id": origin_id,
                "origin_key": origin_key,
                "origin_hash": file_hash,
                "history": [],
            }
        else:
            reasons.append(REASON_ORIGIN_NOT_REGISTERED)
    else:
        expected_key = entry.get("origin_key")
        if expected_key and origin_key and expected_key != origin_key:
            if override_requested:
                override_granted = _can_override(identity_map, payload_map, trust)
                if override_granted:
                    entry["previous_origin_id"] = entry.get("origin_id")
                    entry["origin_id"] = origin_id
                    entry["origin_key"] = origin_key
                else:
                    reasons.append(REASON_ORIGIN_CONFLICT)
            else:
                reasons.append(REASON_ORIGIN_CONFLICT)
        elif expected_key and not origin_key:
            reasons.append(REASON_ORIGIN_MISSING)

        stored_hash = entry.get("origin_hash")
        if stored_hash and stored_hash != file_hash:
            reasons.append(REASON_HASH_MISMATCH)

    alignment_result = evaluate_alignment(operation, payload_map, identity=identity_map)
    if not alignment_result.get("allowed", False):
        reasons.append(REASON_ALIGNMENT_BLOCK)

    allowed = not reasons
    origin_stamp: Optional[Dict[str, Any]] = None
    decision = "override" if override_granted else "allow"

    if allowed and entry is not None:
        timestamp = _now()
        base_stamp = {
            "operation": operation,
            "manifest_key": manifest_key,
            "origin_id": origin_id,
            "origin_key": origin_key,
            "origin_hash": file_hash,
            "trust_marker": trust.get("marker"),
            "trust_sources": trust.get("sources", []),
            "trust_score": trust.get("score"),
            "trust_tier": trust.get("tier"),
            "override": override_granted,
            "timestamp": timestamp,
            "alignment_decision": alignment_result.get("decision"),
        }
        if trust.get("address"):
            base_stamp["resolved_address"] = trust["address"]
        origin_stamp = _build_origin_stamp(base_stamp)

        entry["origin_id"] = origin_id
        entry["origin_key"] = origin_key
        entry["origin_hash"] = file_hash
        history: list[Dict[str, Any]] = list(entry.get("history", []))
        history.append(origin_stamp)
        entry["history"] = history[-20:]
        entry["last_verified_at"] = timestamp
        entry["trust_marker"] = trust.get("marker")
        entries[manifest_key] = entry

        if origin_key:
            contributor_entry = contributors.setdefault(origin_key, {"origin_id": origin_id})
            contributor_entry.update(
                origin_id=origin_id,
                trust_marker=trust.get("marker"),
                trust_sources=trust.get("sources", []),
                trust_score=trust.get("score"),
                trust_tier=trust.get("tier"),
                last_claim=timestamp,
            )
            contributors[origin_key] = contributor_entry
        registry["entries"] = entries
        registry["contributors"] = contributors
        _write_registry(registry)

        if resistance_decision and resistance_decision.audit_entry:
            origin_stamp = {
                **origin_stamp,
                "resistance_override": {
                    "hash": resistance_decision.audit_entry.get("hash"),
                    "status": resistance_decision.audit_entry.get("status"),
                    "reason": resistance_decision.reason,
                },
            }

        _append_log({**origin_stamp, "allowed": True})
        if manifest_obj is not None:
            _persist_signature(manifest_obj, origin_stamp)
    else:
        allowed = False
        decision = "block"
        _append_log(
            {
                "operation": operation,
                "timestamp": _now(),
                "allowed": False,
                "reasons": list(reasons),
                "origin_id": origin_id,
                "manifest_key": manifest_key,
                "resistance_override": (
                    resistance_decision.record if resistance_decision else None
                ),
            }
        )

    return OriginGuardResult(
        allowed=allowed,
        decision=decision,
        reasons=reasons,
        origin_stamp=origin_stamp,
        alignment=alignment_result,
        trust=trust,
        override=override_granted,
        manifest_key=manifest_key,
    )


def register_origin(
    operation: str,
    *,
    manifest_path: Optional[Path | str] = None,
    payload: Optional[Mapping[str, Any]] = None,
    identity: Optional[Mapping[str, Any]] = None,
) -> OriginGuardResult:
    return enforce_origin(
        operation,
        manifest_path=manifest_path,
        payload=payload,
        identity=identity,
        allow_registration=True,
    )


def validate_contributor_claim(
    origin_id: str,
    *,
    identity: Optional[Mapping[str, Any]] = None,
    payload: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    identity_map: Dict[str, Any] = dict(identity or {})
    payload_map: Dict[str, Any] = dict(payload or {})
    candidate = origin_id or _resolve_origin_identity(payload_map, identity_map)
    if not candidate:
        return {
            "origin_id": None,
            "verified": False,
            "reason": REASON_ORIGIN_MISSING,
        }

    trust = _resolve_trust_marker(candidate, payload_map, identity_map)
    registry = _load_registry()
    contributor_entry = registry["contributors"].get(_normalize(candidate), {})
    verified = bool(trust.get("verified"))
    if not verified and trust.get("score", 0.0) >= MIN_TRUST_SCORE:
        verified = True
    if contributor_entry:
        verified = True

    return {
        "origin_id": candidate,
        "verified": verified,
        "trust_marker": trust.get("marker"),
        "trust_score": trust.get("score"),
        "trust_sources": trust.get("sources", []),
        "trust_tier": trust.get("tier"),
        "registry_entry": contributor_entry or None,
    }


__all__ = [
    "register_origin",
    "enforce_origin",
    "validate_contributor_claim",
    "OriginGuardResult",
    "REGISTRY_PATH",
    "LOG_PATH",
]

