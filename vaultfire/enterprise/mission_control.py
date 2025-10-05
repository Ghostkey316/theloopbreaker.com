"""Mission Control utilities for enterprise-grade Vaultfire launches.

The mission control stack keeps the original Vaultfire mission intact while
expanding partner readiness with auditable guardrails. It embraces the
"wallet is passport" rule, ensures ethics-forward activation, and gives
partners differentiated confidence to join the network.

DISCLAIMER:
- Partners remain responsible for their own compliance reviews.
- Ambient telemetry follows the opt-in policies declared in manifest files.
- Nothing here constitutes legal, medical, or financial advice.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from utils.json_io import load_json, write_json
from vaultfire._purposeful_scale import DEFAULT_MISSION_TAGS, authorize_scale
from vaultfire.protocol.mission_anchor import MissionContinuityAnchor

DEFAULT_OPERATION = "enterprise.launchpad"
_BASE_DIR = Path(__file__).resolve().parents[1]
_DEFAULT_COMMITMENTS = {
    "mission": "Belief-secured intelligence for partners who lead with ethics.",
    "pillars": [
        {
            "id": "ethics-led-intelligence",
            "title": "Ethics-Led Intelligence",
            "description": "Confirm every operator honours the morals-first charter.",
            "checks": [
                {
                    "id": "ethics-verification",
                    "description": "Wallet or ENS identity has verified ethics tag.",
                    "profile_keys": ["ethicsVerified", "ethics_verified"],
                },
                {
                    "id": "mission-promise",
                    "description": "Partner has declared a mission aligned with Vaultfire.",
                    "profile_keys": ["declaredPurpose", "mission", "purpose"],
                },
            ],
        },
        {
            "id": "telemetry-trust",
            "title": "Telemetry Trust Fabric",
            "description": "Ensure telemetry routing honours residency and consent gates.",
            "checks": [
                {
                    "id": "telemetry-policy",
                    "description": "Partner supplied telemetry residency policy or opted into defaults.",
                    "profile_keys": ["telemetryPolicy", "telemetry_policy", "residency"],
                },
                {
                    "id": "consent-ops",
                    "description": "Consent operations reference opt-in ledgers.",
                    "profile_keys": ["consentLedger", "consent_ledger"],
                },
            ],
        },
        {
            "id": "resilience-squad",
            "title": "Resilience Squad",
            "description": "Validate queues, webhooks, and failovers are wired for scale.",
            "checks": [
                {
                    "id": "webhook-replay",
                    "description": "Partner tested webhook replay + signature validation.",
                    "profile_keys": ["webhookReplay", "webhook_replay"],
                },
                {
                    "id": "failover-plan",
                    "description": "Failover plan exists for manifests and telemetry sinks.",
                    "profile_keys": ["failoverPlan", "failover_plan"],
                },
            ],
        },
    ],
    "differentiators": [
        {
            "id": "mission-control-loop",
            "summary": "Belief-weighted mission loops broadcast confidence to every tenant.",
        },
        {
            "id": "guardian-beacons",
            "summary": "Purposeful Scale guardrails confirm expansions remain ethics-first.",
        },
        {
            "id": "trust-fabric",
            "summary": "Telemetry trust fabric keeps partner data isolated yet observable.",
        },
    ],
    "observability": {
        "logbook": "logs/enterprise/mission_control.json",
        "signals": ["alignment_guard", "belief_density", "mission_tags"],
    },
}


@dataclass
class EnterpriseMissionControl:
    """Coordinate enterprise readiness while preserving the Vaultfire mission."""

    commitments_path: Optional[Path] = None
    log_path: Optional[Path] = None
    operation: str = DEFAULT_OPERATION
    extra_tags: Iterable[str] = field(default_factory=lambda: ("enterprise", "activation"))
    mission_anchor: MissionContinuityAnchor = field(default_factory=MissionContinuityAnchor)

    def __post_init__(self) -> None:
        base_commitments = self.commitments_path or (
            _BASE_DIR / "configs" / "enterprise" / "mission_commitments.json"
        )
        base_log = self.log_path or (_BASE_DIR / "logs" / "enterprise" / "mission_control.json")
        self.commitments_path = Path(base_commitments)
        self.log_path = Path(base_log)
        self._commitments = self._load_commitments()

    # ------------------------------------------------------------------
    # Commitment helpers
    # ------------------------------------------------------------------
    def _load_commitments(self) -> Dict[str, Any]:
        """Return commitments with defaults if the manifest is unavailable."""
        commitments = load_json(self.commitments_path, _DEFAULT_COMMITMENTS)
        if not commitments.get("mission"):
            commitments["mission"] = _DEFAULT_COMMITMENTS["mission"]
        if not commitments.get("pillars"):
            commitments["pillars"] = list(_DEFAULT_COMMITMENTS["pillars"])
        if not commitments.get("differentiators"):
            commitments["differentiators"] = list(_DEFAULT_COMMITMENTS["differentiators"])
        if not commitments.get("observability"):
            commitments["observability"] = dict(_DEFAULT_COMMITMENTS["observability"])
        return commitments

    @property
    def mission(self) -> str:
        return self._commitments.get("mission", _DEFAULT_COMMITMENTS["mission"])

    def refresh_commitments(self) -> Dict[str, Any]:
        """Reload commitments from disk and return the hydrated payload."""
        self._commitments = self._load_commitments()
        return self._commitments

    def register_mission_anchor(
        self,
        partner_profile: Dict[str, Any],
        commitments: Iterable[str] | None = None,
    ) -> Dict[str, Any]:
        """Issue a Mission Continuity Anchor for the supplied partner."""

        identity = dict(partner_profile)
        anchor = self.mission_anchor.anchor_partner(
            identity,
            commitments=commitments,
            operation=self.operation,
            extra_tags=tuple(self.extra_tags),
        )
        return anchor.export()

    # ------------------------------------------------------------------
    # Checklist & assessment utilities
    # ------------------------------------------------------------------
    def compile_alignment_checklist(self, partner_profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Evaluate commitment pillars against the provided partner profile."""
        checklist: List[Dict[str, Any]] = []
        for pillar in self._commitments.get("pillars", []):
            checks_state = []
            for check in pillar.get("checks", []):
                profile_keys = check.get("profile_keys", [])
                observed: Dict[str, Any] = {}
                satisfied = False
                for key in profile_keys:
                    if key in partner_profile:
                        observed[key] = partner_profile[key]
                        if isinstance(partner_profile[key], bool):
                            satisfied = satisfied or bool(partner_profile[key])
                        elif isinstance(partner_profile[key], str):
                            satisfied = satisfied or bool(partner_profile[key].strip())
                        else:
                            satisfied = satisfied or partner_profile[key] is not None
                checks_state.append(
                    {
                        "id": check.get("id"),
                        "description": check.get("description"),
                        "profile_keys": profile_keys,
                        "observed": observed,
                        "satisfied": satisfied,
                    }
                )
            checklist.append(
                {
                    "pillar": pillar.get("id"),
                    "title": pillar.get("title"),
                    "description": pillar.get("description"),
                    "checks": checks_state,
                    "all_satisfied": all(item["satisfied"] for item in checks_state) if checks_state else True,
                }
            )
        return checklist

    # ------------------------------------------------------------------
    # Mission assessment & blueprint
    # ------------------------------------------------------------------
    def assess_partner(
        self,
        partner_profile: Dict[str, Any],
        *,
        signal_payload: Optional[Dict[str, Any]] = None,
        log: bool = True,
    ) -> Dict[str, Any]:
        """Run a Purposeful Scale authorization and build an enterprise checklist."""
        extra_tags = self._resolve_extra_tags()
        authorized, reason, request, trace = authorize_scale(
            partner_profile,
            self.operation,
            extra_tags=extra_tags,
        )
        checklist = self.compile_alignment_checklist(partner_profile)
        assessment = {
            "timestamp": datetime.utcnow().isoformat(),
            "operation": self.operation,
            "mission": self.mission,
            "mission_tags": request.get("mission_tags", DEFAULT_MISSION_TAGS),
            "declared_purpose": request.get("declared_purpose"),
            "belief_density": request.get("belief_density"),
            "authorized": authorized,
            "reason": reason,
            "alignment_guard": trace.get("alignment_guard"),
            "partner_id": request.get("operation_user") or partner_profile.get("wallet") or partner_profile.get("ens"),
            "checklist": checklist,
            "signal_payload": signal_payload or {},
        }
        if trace.get("mission_reference"):
            assessment["mission_reference"] = trace["mission_reference"]
        next_steps: List[str] = []
        for pillar in checklist:
            if not pillar["all_satisfied"]:
                next_steps.append(
                    f"Strengthen pillar '{pillar['title']}' by completing pending checks."
                )
        if not authorized and reason:
            next_steps.append(f"Resolve Purposeful Scale guardrail: {reason}.")
        elif not authorized:
            next_steps.append("Review Purposeful Scale guardrails and resolve outstanding conditions.")
        assessment["next_steps"] = next_steps
        if log:
            self._append_log_record(assessment)
        return assessment

    def build_enterprise_blueprint(
        self,
        partner_profile: Dict[str, Any],
        *,
        signal_payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Return an enterprise blueprint that highlights differentiators."""
        assessment = self.assess_partner(partner_profile, signal_payload=signal_payload, log=True)
        blueprint = {
            "mission": self.mission,
            "differentiators": self._commitments.get("differentiators", []),
            "observability": self._render_observability(),
            "readiness": {
                "authorized": assessment["authorized"],
                "reason": assessment.get("reason"),
                "belief_density": assessment.get("belief_density"),
                "checklist": assessment["checklist"],
                "next_steps": assessment["next_steps"],
            },
            "signal_payload": assessment.get("signal_payload", {}),
        }
        return blueprint

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _append_log_record(self, record: Dict[str, Any]) -> None:
        log_records = load_json(self.log_path, [])
        log_records.append(record)
        write_json(self.log_path, log_records)

    def _render_observability(self) -> Dict[str, Any]:
        observability = dict(self._commitments.get("observability", {}))
        relative_log = self._relative_log_path()
        observability.setdefault("logbook", relative_log)
        observability.setdefault("signals", _DEFAULT_COMMITMENTS["observability"]["signals"])
        return observability

    def _relative_log_path(self) -> str:
        try:
            return str(self.log_path.relative_to(_BASE_DIR))
        except ValueError:
            return str(self.log_path)

    def _resolve_extra_tags(self) -> List[str]:
        base_tags = list(DEFAULT_MISSION_TAGS)
        if self.extra_tags is None:
            extras: Iterable[str] = ()
        elif isinstance(self.extra_tags, str):
            extras = (self.extra_tags,)
        else:
            extras = (
                tag.strip()
                for tag in self.extra_tags
                if isinstance(tag, str) and tag.strip()
            )

        ordered: List[str] = []
        seen = set()
        for tag in [*base_tags, *extras]:
            if tag not in seen:
                ordered.append(tag)
                seen.add(tag)
        return ordered


__all__ = ["EnterpriseMissionControl"]
