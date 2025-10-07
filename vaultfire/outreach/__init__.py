"""Partner outreach helpers for Vaultfire pilot recruitment."""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Mapping

__all__ = [
    "PartnerProfile",
    "PartnerPitch",
    "get_partner_profile",
    "generate_partner_pitch",
    "verify_partner_readiness",
]


@dataclass(frozen=True)
class PartnerProfile:
    """Metadata describing a potential pilot partner."""

    domain: str
    label: str
    focus_areas: tuple[str, ...]
    readiness_level: str
    sandbox_features: tuple[str, ...]
    requires_identity_anchor: bool = False

    def export(self) -> Mapping[str, object]:
        """Return a serialisable view for logging or diagnostics."""

        return {
            "domain": self.domain,
            "label": self.label,
            "focus_areas": list(self.focus_areas),
            "readiness_level": self.readiness_level,
            "sandbox_features": list(self.sandbox_features),
            "requires_identity_anchor": self.requires_identity_anchor,
        }


@dataclass(frozen=True)
class PartnerPitch:
    """Structured partner pitch payload."""

    subject: str
    body: str
    highlights: tuple[str, ...]
    call_to_action: str
    metadata: Mapping[str, object]

    def as_markdown(self) -> str:
        """Render the pitch as a Markdown string."""

        highlight_lines = "\n".join(f"- {item}" for item in self.highlights)
        return (
            f"## {self.subject}\n\n"
            f"{self.body}\n\n"
            f"### Highlights\n{highlight_lines}\n\n"
            f"**Next Step:** {self.call_to_action}"
        )


_READINESS_TIERS: Mapping[str, int] = MappingProxyType(
    {
        "observing": 0,
        "incubating": 1,
        "aligned": 2,
        "launch_ready": 3,
    }
)


def _normalise_domain(domain: str) -> str:
    if not isinstance(domain, str):
        raise TypeError("domain must be a string")
    value = domain.strip().lower()
    if not value:
        raise ValueError("domain must be provided")
    return value


_PARTNER_PROFILES: Mapping[str, PartnerProfile] = {
    "openai.com": PartnerProfile(
        domain="openai.com",
        label="OpenAI",
        focus_areas=(
            "Frontier alignment research",
            "Ethical AI evaluation",
            "Codex interoperability",
        ),
        readiness_level="launch_ready",
        sandbox_features=("encrypted_telemetry", "ethics_guardian", "fhe_stack"),
        requires_identity_anchor=True,
    ),
    "worldcoin.org": PartnerProfile(
        domain="worldcoin.org",
        label="Worldcoin",
        focus_areas=(
            "Biometric anchor validation",
            "Guardian governance bridges",
            "High-volume onboarding",
        ),
        readiness_level="aligned",
        sandbox_features=("identity_anchor", "guardian_loop", "compliance_pack"),
        requires_identity_anchor=True,
    ),
    "cohere.com": PartnerProfile(
        domain="cohere.com",
        label="Cohere",
        focus_areas=(
            "Enterprise language tooling",
            "Model evaluation transparency",
            "Partner developer enablement",
        ),
        readiness_level="aligned",
        sandbox_features=("encrypted_telemetry", "sdk_bridge", "loyalty_uplift"),
    ),
    "ns3.ai": PartnerProfile(
        domain="ns3.ai",
        label="NS3",
        focus_areas=(
            "Passive yield experimentation",
            "Belief-weighted education",
            "Guardian aligned pilots",
        ),
        readiness_level="launch_ready",
        sandbox_features=("passive_yield_logic", "guardian_loop", "telemetry_portal"),
    ),
    "signal.org": PartnerProfile(
        domain="signal.org",
        label="Signal",
        focus_areas=(
            "Private messaging telemetry",
            "End-to-end encrypted consent flows",
            "Ethical analytics minimisation",
        ),
        readiness_level="launch_ready",
        sandbox_features=("encrypted_telemetry", "privacy_safeguards", "mission_anchor"),
    ),
    "ethstorage.org": PartnerProfile(
        domain="ethstorage.org",
        label="EthStorage",
        focus_areas=(
            "Decentralised storage",
            "On-chain attestations",
            "Long-horizon mission continuity",
        ),
        readiness_level="aligned",
        sandbox_features=("immutable_logs", "guardian_loop", "compliance_pack"),
    ),
    "humanloop.com": PartnerProfile(
        domain="humanloop.com",
        label="Humanloop",
        focus_areas=(
            "Human-in-the-loop training",
            "Responsible deployment frameworks",
            "Partner co-design rituals",
        ),
        readiness_level="incubating",
        sandbox_features=("research_mode", "feedback_orbits", "telemetry_portal"),
    ),
}


def get_partner_profile(domain: str) -> PartnerProfile | None:
    """Return a partner profile if the domain is recognised."""

    return _PARTNER_PROFILES.get(_normalise_domain(domain))


def _resolve_minimum_tier(minimum_tier: str) -> int:
    try:
        return _READINESS_TIERS[minimum_tier]
    except KeyError as exc:  # pragma: no cover - defensive guard
        raise ValueError(f"unknown readiness tier: {minimum_tier}") from exc


def generate_partner_pitch(
    domain: str,
    *,
    use_case: str,
    include_identity_anchor: bool | None = None,
) -> PartnerPitch:
    """Create a partner pitch tailored to the specified organisation."""

    profile = get_partner_profile(domain)
    normalised_domain = _normalise_domain(domain)
    label = profile.label if profile else normalised_domain
    if not isinstance(use_case, str):
        raise TypeError("use_case must be a string")
    trimmed_use_case = use_case.strip()
    if not trimmed_use_case:
        raise ValueError("use_case must be provided")
    highlight_identity = (
        profile.requires_identity_anchor if profile and include_identity_anchor is None else bool(include_identity_anchor)
    )
    focus_points = profile.focus_areas if profile else ("Ethical pilot activation", "Telemetry safeguards", "Guardian review")
    features = profile.sandbox_features if profile else ("encrypted_telemetry", "fhe_stack")
    highlights = [
        f"Mission: {trimmed_use_case}",
        "FHE-secured telemetry loop",
        "Passive yield logic included",
    ]
    highlights.extend(focus_points[:2])
    if highlight_identity:
        highlights.append("Biometric anchor validation ready")
    body_lines = [
        f"Hi {label} team,",
        "",
        "Vaultfire is activating a limited cohort of pilot partners and your mission footprint makes you a prime candidate.",
        f"We'd like to explore {trimmed_use_case} with you while keeping belief-first guardrails intact.",
        "",
        "The sandbox stack we spin up includes:",
    ]
    for feature in features:
        body_lines.append(f"- {feature.replace('_', ' ')}")
    if highlight_identity:
        body_lines.append("- Identity anchors + consent orchestration")
    body_lines.extend(
        [
            "",
            "We maintain real-time telemetry mirrors, guardian-reviewed governance, and transparent readiness checklists.",
            "Let us know a good window to sync and we'll ship the attestation packet ahead of the call.",
        ]
    )
    metadata = {
        "domain": normalised_domain,
        "readiness_level": profile.readiness_level if profile else "observing",
        "requires_identity_anchor": highlight_identity,
    }
    return PartnerPitch(
        subject=f"Vaultfire Pilot: {label}",
        body="\n".join(body_lines),
        highlights=tuple(dict.fromkeys(highlights)),
        call_to_action="Reply with a guardian contact to begin the sandbox handshake.",
        metadata=MappingProxyType(metadata),
    )


def verify_partner_readiness(
    domain: str,
    *,
    minimum_tier: str = "aligned",
    require_identity_anchor: bool = False,
) -> bool:
    """Determine whether the given partner domain meets the readiness threshold."""

    profile = get_partner_profile(domain)
    if not profile:
        return False
    if require_identity_anchor and not profile.requires_identity_anchor:
        return False
    partner_score = _READINESS_TIERS[profile.readiness_level]
    required_score = _resolve_minimum_tier(minimum_tier)
    return partner_score >= required_score
