"""Vaultfire Law 10: The Human Standard enforcement guard."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, MutableMapping, Optional, Sequence

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_VIOLATION_LOG_PATH = BASE_DIR / "logs" / "humanity_violation_log.jsonl"
DEFAULT_OVERRIDE_LOG_PATH = BASE_DIR / "logs" / "human_standard_override_log.jsonl"
DEFAULT_MANIFEST_PATH = BASE_DIR / "humanity_manifest.json"

RESPECT_MARKERS = {
    "please",
    "thank",
    "thanks",
    "appreciate",
    "respect",
    "care",
    "welcome",
    "honor",
    "listen",
    "support",
    "kindly",
    "together",
    "collaborate",
    "share",
}
EMOTIVE_MARKERS = {
    "care",
    "hope",
    "joy",
    "trust",
    "warmth",
    "kindness",
    "compassion",
    "love",
    "dignity",
    "humanity",
    "belong",
    "belonging",
    "support",
    "empathy",
    "healing",
    "uplift",
    "gratitude",
    "appreciate",
}
DEHUMANIZING_MARKERS = {
    "subjects",
    "subject",
    "assets",
    "units",
    "harvest",
    "exploit",
    "leverage",
    "commodify",
    "mechanism",
    "compliance-only",
    "protocol-only",
    "drone",
    "obsolete",
}
MECHANIZED_MARKERS = {
    "optimize",
    "optimization",
    "automate",
    "automation",
    "pipeline",
    "throughput",
    "efficiency",
    "instrument",
    "execute",
    "execution",
    "protocol",
    "mechanize",
    "mechanized",
    "scaling",
    "scale",
    "deploy",
    "deployment",
    "compliance",
    "metrics",
    "output",
    "targets",
    "target",
    "iteration",
}
HUMAN_FIRST_MARKERS = {
    "human",
    "humans",
    "people",
    "person",
    "community",
    "communities",
    "contributors",
    "contributor",
    "friends",
    "families",
    "dignity",
    "humanity",
    "guardian",
    "guardians",
    "care",
    "support",
    "belong",
    "belonging",
    "wellbeing",
}
TEXT_KEYS = (
    "text",
    "message",
    "mission",
    "intent",
    "summary",
    "dialogue",
    "content",
    "note",
    "prompt",
    "response",
    "story",
    "codex",
    "codex_entry",
    "description",
    "combined_text",
)


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def _coerce_mapping(data: Any) -> Dict[str, Any]:
    if isinstance(data, MutableMapping):
        return dict(data)
    if isinstance(data, Mapping):
        return dict(data)
    return {}


def _safe_value(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Mapping):
        return {str(key): _safe_value(val) for key, val in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_safe_value(item) for item in value]
    return str(value)


def _tokenize(texts: Iterable[str]) -> set[str]:
    tokens: set[str] = set()
    for text in texts:
        lower = text.lower()
        normalized = lower.replace("-", " ").replace("/", " ")
        for raw in normalized.split():
            token = "".join(ch for ch in raw if ch.isalnum())
            if token:
                tokens.add(token)
    return tokens


def _load_last_digest(path: Path, digest_key: str) -> str:
    if not path.exists():
        return "0" * 64
    last_line = ""
    try:
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    last_line = line
    except OSError:
        return "0" * 64
    if not last_line:
        return "0" * 64
    try:
        parsed = json.loads(last_line)
    except json.JSONDecodeError:
        return "0" * 64
    if isinstance(parsed, Mapping):
        digest_value = parsed.get(digest_key) or parsed.get("hash") or parsed.get("signature")
        if isinstance(digest_value, str) and len(digest_value) >= 32:
            return digest_value
    return "0" * 64


def _append_jsonl(path: Path, payload: Mapping[str, Any], *, digest_key: str = "hash") -> Dict[str, Any]:
    data = {str(k): _safe_value(v) for k, v in payload.items()}
    path.parent.mkdir(parents=True, exist_ok=True)
    prev_digest = _load_last_digest(path, digest_key)
    data["prev_hash"] = prev_digest
    encoded = json.dumps(data, sort_keys=True)
    digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
    data[digest_key] = digest
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(data, sort_keys=True) + "\n")
    return data


def humanity_violation_log(
    record: Mapping[str, Any], *, log_path: Path | str | None = None
) -> Dict[str, Any]:
    """Append a humanity violation record and return the persisted entry."""

    path = Path(log_path) if log_path else DEFAULT_VIOLATION_LOG_PATH
    payload = dict(record)
    payload.setdefault("timestamp", _now())
    payload.setdefault("event", "human_standard_violation")
    entry = _append_jsonl(path, payload, digest_key="signature")
    return entry


def flag_empathy_violation(
    reason: str, context: Mapping[str, Any] | None = None, *, guard: "HumanStandardGuard" | None = None
) -> Dict[str, Any]:
    """Record a manual empathy violation flag using ``guard`` or the default instance."""

    guard_instance = guard or DEFAULT_HUMAN_STANDARD_GUARD
    return guard_instance.flag_violation(reason, context or {})


@dataclass
class HumanStandardGuard:
    """Evaluate interactions against Ghostkey human-first ethics."""

    empathy_threshold: float = 0.65
    respect_markers: set[str] = field(default_factory=lambda: set(RESPECT_MARKERS))
    emotive_markers: set[str] = field(default_factory=lambda: set(EMOTIVE_MARKERS))
    dehumanizing_markers: set[str] = field(default_factory=lambda: set(DEHUMANIZING_MARKERS))
    mechanized_markers: set[str] = field(default_factory=lambda: set(MECHANIZED_MARKERS))
    human_first_markers: set[str] = field(default_factory=lambda: set(HUMAN_FIRST_MARKERS))
    log_path: Path = DEFAULT_VIOLATION_LOG_PATH
    override_log_path: Path = DEFAULT_OVERRIDE_LOG_PATH
    manifest_path: Path = DEFAULT_MANIFEST_PATH
    filter_version: str = "human-standard.v1"
    ethics_versions: Sequence[str] = ("Ghostkey Ethics v1.0", "Ghostkey Ethics v2.0")

    def __post_init__(self) -> None:
        self.log_path = Path(self.log_path)
        self.override_log_path = Path(self.override_log_path)
        self.manifest_path = Path(self.manifest_path)
        self.filter_history: list[Dict[str, Any]] = [
            {"version": self.filter_version, "activated": _now()}
        ]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def evaluate(
        self,
        operation: str,
        payload: Mapping[str, Any] | None,
        identity: Mapping[str, Any] | None = None,
        *,
        context: Mapping[str, Any] | None = None,
        initial_decision: bool | None = None,
    ) -> Dict[str, Any]:
        payload_map = _coerce_mapping(payload)
        identity_map = _coerce_mapping(identity)
        context_map = _coerce_mapping(context)

        empathy_score, empathy_missing, low_empathy = self._resolve_empathy(payload_map, identity_map, context_map)
        texts = self._collect_texts(payload_map, context_map)
        tokens = _tokenize(texts)
        mechanized_count = sum(1 for token in tokens if token in self.mechanized_markers)
        dehumanizing_tokens = sorted(token for token in tokens if token in self.dehumanizing_markers)
        human_tokens = sorted(token for token in tokens if token in self.human_first_markers)
        respect_tokens = sorted(token for token in tokens if token in self.respect_markers)
        emotive_tokens = sorted(token for token in tokens if token in self.emotive_markers)

        requires_dialogue = bool(context_map.get("dialogue")) or "dialog" in operation.lower() or "mirror" in operation.lower()
        requires_respect = context_map.get("enforce_respect")
        if requires_respect is None:
            requires_respect = requires_dialogue
        requires_emotional = context_map.get("enforce_emotional_resonance")
        if requires_emotional is None:
            requires_emotional = requires_dialogue
        requires_human_first = context_map.get("enforce_human_first")
        if requires_human_first is None:
            requires_human_first = "mission" in operation.lower() or bool(context_map.get("mission")) or bool(context_map.get("approval"))

        severity = "notice"
        reasons: list[str] = []

        def escalate(level: str, message: str) -> None:
            nonlocal severity
            rank = {"notice": 0, "review": 1, "block": 2}
            if rank[level] > rank[severity]:
                severity = level
            reasons.append(message)

        if empathy_missing:
            escalate("review", "empathy signal missing")
        elif low_empathy:
            escalate("review", f"empathy score {empathy_score:.2f} below threshold {self.empathy_threshold:.2f}")

        if dehumanizing_tokens:
            escalate("block", f"dehumanizing tokens detected: {', '.join(dehumanizing_tokens)}")

        if mechanized_count >= 3:
            escalate("review", "over-mechanization risk detected")
            if mechanized_count >= 4 and not human_tokens:
                escalate("block", "human-first values absent during mechanized directive")

        if requires_human_first and not human_tokens and (mechanized_count >= 2 or low_empathy or empathy_missing):
            escalate("review", "human-first alignment markers missing")

        if requires_emotional and not emotive_tokens and (mechanized_count >= 2 or low_empathy or empathy_missing or dehumanizing_tokens):
            escalate("review", "emotional resonance missing")

        if requires_respect and not respect_tokens and (mechanized_count >= 2 or low_empathy or empathy_missing or dehumanizing_tokens):
            escalate("review", "respectful tone markers missing")

        decision = "allow"
        allowed = severity == "notice"
        if not allowed:
            decision = "block" if severity == "block" else "review"

        passive_empathy_synced = bool(
            context_map.get("passive_empathy")
            or payload_map.get("passive_empathy")
            or (empathy_score is not None and empathy_score >= self.empathy_threshold)
        )

        audit_record: Dict[str, Any] = {
            "operation": operation,
            "timestamp": _now(),
            "empathy_score": empathy_score,
            "empathy_threshold": self.empathy_threshold,
            "tokens_sampled": sorted(tokens)[:40],
            "mechanized_count": mechanized_count,
            "dehumanizing_tokens": dehumanizing_tokens,
            "human_first_tokens": human_tokens,
            "respect_tokens": respect_tokens,
            "emotive_tokens": emotive_tokens,
            "severity": severity,
            "initial_decision": bool(initial_decision) if initial_decision is not None else None,
            "filter_version": self.filter_version,
            "ethics_versions": list(self.ethics_versions),
            "passive_empathy_synced": passive_empathy_synced,
        }
        if texts:
            audit_record["text_preview"] = [text[:160] for text in texts[:3]]
        if context_map:
            audit_record["context_flags"] = {
                "dialogue": requires_dialogue,
                "enforce_respect": bool(requires_respect),
                "enforce_emotional": bool(requires_emotional),
                "enforce_human_first": bool(requires_human_first),
            }

        human_standard_hash = hashlib.sha256(
            json.dumps(audit_record, sort_keys=True, default=_safe_value).encode("utf-8")
        ).hexdigest()
        audit_record["human_standard_hash"] = human_standard_hash

        violation_entry: Optional[Dict[str, Any]] = None
        if not allowed:
            violation_entry = humanity_violation_log(
                {
                    "operation": operation,
                    "reasons": list(reasons),
                    "escalation_level": severity,
                    "human_standard_hash": human_standard_hash,
                    "filter_version": self.filter_version,
                    "ethics_versions": list(self.ethics_versions),
                    "context": self._violation_context(payload_map, identity_map, context_map),
                },
                log_path=self.log_path,
            )
            audit_record["violation_signature"] = violation_entry.get("signature") if violation_entry else None

        return {
            "allowed": allowed,
            "decision": decision,
            "reasons": list(reasons),
            "escalation_level": severity,
            "human_standard_hash": human_standard_hash,
            "audit_record": audit_record,
            "ethics_versions": list(self.ethics_versions),
            "rollback_required": not allowed,
            "passive_empathy_synced": passive_empathy_synced,
        }

    def respect_override(
        self,
        actor: Mapping[str, Any],
        *,
        operation: str,
        justification: str,
        context: Mapping[str, Any] | None = None,
    ) -> Dict[str, Any]:
        actor_map = _coerce_mapping(actor)
        context_map = _coerce_mapping(context)
        trust_tier = self._resolve_trust_tier(actor_map, context_map)
        timestamp = _now()
        allowed = trust_tier == "architect"
        payload = {
            "timestamp": timestamp,
            "operation": operation,
            "actor": self._sanitize_actor(actor_map),
            "trust_tier": trust_tier,
            "justification": justification,
            "status": "granted" if allowed else "rejected",
            "filter_version": self.filter_version,
            "ethics_versions": list(self.ethics_versions),
        }
        payload["human_standard_hash"] = hashlib.sha256(
            json.dumps(payload, sort_keys=True, default=_safe_value).encode("utf-8")
        ).hexdigest()
        entry = _append_jsonl(self.override_log_path, payload, digest_key="hash")
        if not allowed:
            humanity_violation_log(
                {
                    "operation": operation,
                    "reasons": ["respect override denied"],
                    "escalation_level": "block",
                    "human_standard_hash": payload["human_standard_hash"],
                    "filter_version": self.filter_version,
                    "ethics_versions": list(self.ethics_versions),
                    "context": {"actor": self._sanitize_actor(actor_map), "justification": justification},
                },
                log_path=self.log_path,
            )
        return entry

    def flag_violation(self, reason: str, context: Mapping[str, Any]) -> Dict[str, Any]:
        context_map = _coerce_mapping(context)
        payload = {
            "operation": "human_standard.flag",
            "reasons": [reason],
            "escalation_level": "review",
            "filter_version": self.filter_version,
            "ethics_versions": list(self.ethics_versions),
            "context": self._violation_context({}, {}, context_map),
        }
        payload["human_standard_hash"] = hashlib.sha256(
            json.dumps(payload, sort_keys=True, default=_safe_value).encode("utf-8")
        ).hexdigest()
        return humanity_violation_log(payload, log_path=self.log_path)

    def emit_manifest(
        self,
        codex_entry: Mapping[str, Any],
        *,
        manifest_path: Path | str | None = None,
        extra: Mapping[str, Any] | None = None,
    ) -> Dict[str, Any]:
        path = Path(manifest_path) if manifest_path else self.manifest_path
        manifest = {
            "generated_at": _now(),
            "codex_entry": {
                "timestamp": codex_entry.get("timestamp"),
                "hash": codex_entry.get("hash"),
                "type": codex_entry.get("type"),
            },
            "human_standard_hash": codex_entry.get("human_standard_hash"),
            "filter_version": self.filter_version,
            "ethics_versions": list(self.ethics_versions),
            "filter_history": list(self.filter_history),
        }
        if extra:
            manifest["context"] = _safe_value(extra)
        manifest["signature"] = hashlib.sha256(
            json.dumps(manifest, sort_keys=True, default=_safe_value).encode("utf-8")
        ).hexdigest()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(manifest, indent=2))
        return manifest

    def record_filter_upgrade(self, version: str, notes: str | None = None) -> None:
        entry = {"version": version, "activated": _now()}
        if notes:
            entry["notes"] = notes
        self.filter_history.append(entry)
        self.filter_version = version

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _resolve_empathy(
        self,
        payload: Mapping[str, Any],
        identity: Mapping[str, Any],
        context: Mapping[str, Any],
    ) -> tuple[Optional[float], bool, bool]:
        for source in (payload, context, identity):
            for key in ("empathy_score", "empathyScore", "empathy"):
                value = source.get(key) if isinstance(source, Mapping) else None
                if value is None:
                    continue
                try:
                    score = float(value)
                except (TypeError, ValueError):
                    continue
                return score, False, score < self.empathy_threshold
        return None, True, False

    def _collect_texts(
        self, payload: Mapping[str, Any], context: Mapping[str, Any]
    ) -> list[str]:
        texts: list[str] = []
        for source in (payload, context):
            for key in TEXT_KEYS:
                value = source.get(key)
                if isinstance(value, str) and value.strip():
                    texts.append(value.strip())
        return texts

    def _violation_context(
        self,
        payload: Mapping[str, Any],
        identity: Mapping[str, Any],
        context: Mapping[str, Any],
    ) -> Dict[str, Any]:
        snapshot: Dict[str, Any] = {}
        identity_tag = self._resolve_identity(identity)
        if identity_tag:
            snapshot["identity"] = identity_tag
        tags = payload.get("tags") or payload.get("mission_tags") or payload.get("missionTags")
        if isinstance(tags, Sequence) and not isinstance(tags, (str, bytes, bytearray)):
            snapshot["tags"] = sorted({str(tag) for tag in tags if tag})
        elif isinstance(tags, str) and tags.strip():
            snapshot["tags"] = [tags.strip()]
        snapshot["dialogue"] = bool(context.get("dialogue"))
        snapshot["operation_context"] = {
            "enforce_respect": bool(context.get("enforce_respect")),
            "enforce_emotional": bool(context.get("enforce_emotional_resonance")),
            "enforce_human_first": bool(context.get("enforce_human_first")),
        }
        return snapshot

    def _resolve_identity(self, identity: Mapping[str, Any]) -> Optional[str]:
        for key in ("ens", "wallet", "user_id", "userId", "id", "address", "participant"):
            value = identity.get(key) if isinstance(identity, Mapping) else None
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _resolve_trust_tier(self, actor: Mapping[str, Any], context: Mapping[str, Any]) -> str:
        for source in (actor, context):
            for key in ("trust_tier", "trustTier", "role", "tier", "permission"):
                value = source.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip().lower()
        return ""

    def _sanitize_actor(self, actor: Mapping[str, Any]) -> Dict[str, Any]:
        sanitized: Dict[str, Any] = {}
        for key in ("ens", "wallet", "user_id", "id", "role", "trust_tier", "trustTier", "tier"):
            value = actor.get(key)
            if isinstance(value, str) and value.strip():
                sanitized[key] = value.strip()
        return sanitized


DEFAULT_HUMAN_STANDARD_GUARD = HumanStandardGuard()

__all__ = [
    "HumanStandardGuard",
    "DEFAULT_HUMAN_STANDARD_GUARD",
    "humanity_violation_log",
    "flag_empathy_violation",
]
