"""Onboarding guardrails for DevDay Agent Builder deployments."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Mapping, MutableMapping, Sequence

__all__ = ["OnboardingGuardrails", "secure_protocol"]


@dataclass
class OnboardingGuardrails:
    """Represents onboarding requirements for Vaultfire agents."""

    required_steps: Sequence[str] = field(default_factory=tuple)
    required_tags: Sequence[str] = field(default_factory=tuple)
    secure_mode: bool = True

    def export(self) -> Mapping[str, object]:
        return {
            "required_steps": list(self.required_steps),
            "required_tags": list(self.required_tags),
            "secure_mode": self.secure_mode,
        }

    def validate_profile(self, profile: Mapping[str, object]) -> MutableMapping[str, object]:
        missing_steps = [step for step in self.required_steps if not profile.get(step)]
        missing_tags = [tag for tag in self.required_tags if tag not in profile.get("tags", [])]
        return {
            "missing_steps": missing_steps,
            "missing_tags": missing_tags,
            "eligible": not missing_steps and not missing_tags,
        }


def secure_protocol(
    *,
    required_steps: Iterable[str] = ("kyc", "mission_alignment", "wallet_verification"),
    required_tags: Iterable[str] = ("agent-builder", "vaultfire"),
    secure_mode: bool = True,
) -> OnboardingGuardrails:
    """Return default guardrails for DevDay onboarding flows."""

    return OnboardingGuardrails(
        required_steps=tuple(required_steps),
        required_tags=tuple(required_tags),
        secure_mode=secure_mode,
    )

