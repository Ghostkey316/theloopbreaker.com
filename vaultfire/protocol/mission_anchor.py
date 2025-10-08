"""Mission continuity anchors keep Vaultfire's purpose irreplicable."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import sha256
from typing import Dict, Iterable, Mapping, MutableMapping, Sequence, Tuple

from vaultfire._purposeful_scale import DEFAULT_MISSION_TAGS, authorize_scale, build_scale_request

_DEFAULT_OPERATION = "vaultfire.mission-anchor"


@dataclass(slots=True)
class MissionAnchorRecord:
    """Immutable record representing a partner's mission anchor."""

    partner_id: str
    mission: str
    commitments: Tuple[str, ...]
    signature: str
    anchored_at: datetime
    resonance: float
    purposeful_request: Mapping[str, object]
    purposeful_trace: Mapping[str, object]
    telemetry_hooks: Tuple[str, ...]
    regenerative_identity: Mapping[str, object]
    resilience_stack: Tuple[str, ...]

    def export(self) -> Dict[str, object]:
        """Return a JSON-serialisable payload for downstream systems."""

        return {
            "partner_id": self.partner_id,
            "mission": self.mission,
            "commitments": list(self.commitments),
            "signature": self.signature,
            "anchored_at": self.anchored_at.replace(tzinfo=timezone.utc).isoformat(),
            "resonance": self.resonance,
            "purposeful_request": dict(self.purposeful_request),
            "purposeful_trace": dict(self.purposeful_trace),
            "telemetry_hooks": list(self.telemetry_hooks),
            "regenerative_identity": dict(self.regenerative_identity),
            "resilience_stack": list(self.resilience_stack),
        }


@dataclass
class MissionContinuityAnchor:
    """Mission gate that ensures Vaultfire expansions never lose the mission."""

    canonical_mission: str = "Belief-secured intelligence for partners who lead with ethics."
    minimum_resonance: float = 0.64
    default_operation: str = _DEFAULT_OPERATION
    extra_tags: Sequence[str] = ("mission", "continuity")
    telemetry_hooks: Sequence[str] = (
        "telemetry_compliance",
        "regenerative_identity",
        "ethics_logic",
    )
    resilience_stack: Sequence[str] = (
        "temporal_resonance_guard",
        "zero_knowledge_circuit_breaker",
        "HorizonSignalLoom",
        "consent_token_exchange",
        "biofeedback_alignment_loops",
        "edge_trust_pods",
    )
    _anchors: MutableMapping[str, MissionAnchorRecord] = field(default_factory=dict, init=False, repr=False)

    def anchor_partner(
        self,
        identity: Mapping[str, object],
        *,
        mission_override: str | None = None,
        commitments: Iterable[str] | None = None,
        operation: str | None = None,
        extra_tags: Sequence[str] | None = None,
        telemetry_hooks: Sequence[str] | None = None,
        resilience_overrides: Sequence[str] | None = None,
    ) -> MissionAnchorRecord:
        """Register a partner mission anchor after Purposeful Scale approval."""

        normalized_identity = dict(identity)
        mission_text = mission_override or self._resolve_mission(normalized_identity)
        normalized_identity.setdefault("mission", mission_text)
        normalized_identity.setdefault("declaredPurpose", mission_text)

        partner_id, _ = build_scale_request(
            normalized_identity,
            operation or self.default_operation,
            extra_tags=self._merge_tags(extra_tags),
        )
        allowed, reason, request, trace = authorize_scale(
            normalized_identity,
            operation or self.default_operation,
            extra_tags=self._merge_tags(extra_tags),
        )
        if not allowed:
            raise PermissionError(f"Purposeful Scale denied mission anchor for {partner_id}: {reason}")

        commitments_tuple = self._normalise_commitments(commitments)
        hooks_tuple = self._normalise_hooks(telemetry_hooks)
        resilience_tuple = self._normalise_resilience(resilience_overrides)
        identity_profile = self._build_regenerative_identity(normalized_identity, hooks_tuple)
        resonance = self._calculate_resonance(
            mission_text,
            commitments_tuple,
            request,
            hooks_tuple,
            resilience_tuple,
        )
        if resonance < self.minimum_resonance:
            raise ValueError(
                f"mission resonance {resonance:.2f} below threshold {self.minimum_resonance:.2f} for {partner_id}"
            )

        signature = self._build_signature(partner_id, mission_text, commitments_tuple, request)
        record = MissionAnchorRecord(
            partner_id=partner_id,
            mission=mission_text,
            commitments=commitments_tuple,
            signature=signature,
            anchored_at=datetime.now(timezone.utc),
            resonance=resonance,
            purposeful_request=request,
            purposeful_trace=trace,
            telemetry_hooks=hooks_tuple,
            regenerative_identity=identity_profile,
            resilience_stack=resilience_tuple,
        )
        self._anchors[partner_id] = record
        return record

    def verify_anchor(
        self,
        partner_id: str,
        mission: str,
        commitments: Iterable[str] | None = None,
        *,
        request_context: Mapping[str, object] | None = None,
    ) -> bool:
        """Validate that the provided mission payload matches the stored anchor."""

        record = self._anchors.get(partner_id)
        if record is None:
            return False
        commitments_tuple = self._normalise_commitments(commitments)
        signature = self._build_signature(
            partner_id,
            mission,
            commitments_tuple,
            request_context or record.purposeful_request,
        )
        return signature == record.signature

    def get_anchor(self, partner_id: str) -> MissionAnchorRecord | None:
        """Return the stored anchor for the partner if available."""

        return self._anchors.get(partner_id)

    def list_anchors(self) -> Tuple[MissionAnchorRecord, ...]:
        """Return all registered anchors."""

        return tuple(self._anchors.values())

    def _merge_tags(self, extra_tags: Sequence[str] | None) -> Tuple[str, ...]:
        tags = list(self.extra_tags)
        if extra_tags:
            tags.extend(extra_tags)
        # Always include mission tags to preserve provenance.
        tags.extend(DEFAULT_MISSION_TAGS)
        seen = set()
        merged = []
        for tag in tags:
            if not isinstance(tag, str):
                continue
            value = tag.strip()
            if not value or value in seen:
                continue
            seen.add(value)
            merged.append(value)
        return tuple(merged)

    def _normalise_commitments(self, commitments: Iterable[str] | None) -> Tuple[str, ...]:
        result = []
        if commitments:
            for item in commitments:
                if not isinstance(item, str):
                    continue
                value = item.strip()
                if value and value not in result:
                    result.append(value)
        return tuple(result)

    def _resolve_mission(self, identity: Mapping[str, object]) -> str:
        for key in ("mission", "declaredPurpose", "purpose"):
            value = identity.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return self.canonical_mission

    def _calculate_resonance(
        self,
        mission: str,
        commitments: Tuple[str, ...],
        request: Mapping[str, object],
        telemetry_hooks: Tuple[str, ...],
        resilience_stack: Tuple[str, ...],
    ) -> float:
        mission_lower = mission.lower()
        tag_hits = sum(1 for tag in DEFAULT_MISSION_TAGS if tag.lower() in mission_lower)
        commitment_bonus = min(len(commitments), 5) * 0.04
        belief_density_value = request.get("belief_density", 0.5)
        empathy_value = request.get("empathy_score", 0.5)
        try:
            belief_density = float(belief_density_value)
        except (TypeError, ValueError):
            belief_density = 0.5
        try:
            empathy = float(empathy_value)
        except (TypeError, ValueError):
            empathy = 0.5
        ethics_bonus = 0.08 if "ethic" in mission_lower else 0.0
        hook_bonus = min(len(telemetry_hooks), 5) * 0.02
        resilience_bonus = min(len(resilience_stack), 6) * 0.015
        resonance = 0.45 + tag_hits * 0.06 + commitment_bonus + ethics_bonus + hook_bonus + resilience_bonus
        resonance += 0.12 * min(1.0, belief_density) + 0.09 * min(1.0, empathy)
        return round(min(resonance, 0.99), 4)

    def _build_signature(
        self,
        partner_id: str,
        mission: str,
        commitments: Tuple[str, ...],
        request: Mapping[str, object],
    ) -> str:
        payload = {
            "partner_id": partner_id,
            "mission": mission,
            "commitments": commitments,
            "request": request,
        }
        encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        return sha256(encoded).hexdigest()

    def _normalise_hooks(self, hooks: Sequence[str] | None) -> Tuple[str, ...]:
        values = list(self.telemetry_hooks)
        if hooks:
            values.extend(hooks)
        return self._dedupe_text(values)

    def _normalise_resilience(self, overrides: Sequence[str] | None) -> Tuple[str, ...]:
        values = list(self.resilience_stack)
        if overrides:
            values.extend(overrides)
        return self._dedupe_text(values)

    def _dedupe_text(self, values: Iterable[str]) -> Tuple[str, ...]:
        seen = set()
        normalised: list[str] = []
        for raw in values:
            if not isinstance(raw, str):
                continue
            trimmed = raw.strip()
            if not trimmed or trimmed in seen:
                continue
            seen.add(trimmed)
            normalised.append(trimmed)
        return tuple(normalised)

    def _build_regenerative_identity(
        self,
        identity: Mapping[str, object],
        hooks: Tuple[str, ...],
    ) -> Mapping[str, object]:
        fingerprint_source = json.dumps(identity, sort_keys=True, default=str).encode("utf-8")
        fingerprint = sha256(fingerprint_source).hexdigest()
        return {
            "fingerprint": fingerprint,
            "hooks": list(hooks),
            "consent_token": sha256((fingerprint + "::consent").encode("utf-8")).hexdigest(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }


__all__ = ["MissionContinuityAnchor", "MissionAnchorRecord"]
