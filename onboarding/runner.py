"""Runbook helpers powering the vaultfire_onboard utility."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, MutableMapping, Sequence

from codex.pilot import initialise_sandbox

_CONFIG_PATH = Path(__file__).resolve().parent / "path_config.yaml"
_HISTORY_PATH = Path(__file__).resolve().parent / "onboarding_history.jsonl"


@dataclass(frozen=True)
class OnboardingPlan:
    """Structured representation of an onboarding execution."""

    path: str
    partner: str
    description: str
    steps: Sequence[str]
    dry_run: bool
    generated_at: datetime
    sandbox_summary: Mapping[str, Any] | None = None

    def export(self) -> MutableMapping[str, Any]:
        payload: MutableMapping[str, Any] = {
            "path": self.path,
            "partner": self.partner,
            "description": self.description,
            "steps": list(self.steps),
            "dry_run": self.dry_run,
            "generated_at": self.generated_at.isoformat(),
        }
        if self.sandbox_summary is not None:
            payload["sandbox_summary"] = dict(self.sandbox_summary)
        return payload


def load_path_config(path: Path | None = None) -> Mapping[str, Any]:
    config_path = path or _CONFIG_PATH
    data = json.loads(config_path.read_text(encoding="utf-8"))
    if not isinstance(data, Mapping):
        raise ValueError("path_config.yaml must define a mapping")
    return data


def _append_history(plan: OnboardingPlan) -> None:
    _HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _HISTORY_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(plan.export(), sort_keys=True) + "\n")


def run_onboarding(
    path_name: str,
    partner: str,
    *,
    dry_run: bool = False,
    profile_path: Path | None = None,
) -> OnboardingPlan:
    config = load_path_config()
    paths = config.get("paths", {})
    if path_name not in paths:
        raise KeyError(f"unknown onboarding path: {path_name}")
    entry = paths[path_name]
    description = str(entry.get("description", ""))
    steps = entry.get("steps", [])
    if not isinstance(steps, Sequence):
        raise TypeError("path steps must be a sequence")
    if len(steps) > 4:
        raise ValueError("each onboarding path must contain fewer than five steps")

    sandbox_summary: Mapping[str, Any] | None = None
    if not dry_run and path_name in {"codex-only", "full-sovereign"}:
        profile = profile_path or Path("sandbox_profile.yaml")
        sandbox_summary = initialise_sandbox(profile).export()

    plan = OnboardingPlan(
        path=path_name,
        partner=partner,
        description=description,
        steps=list(steps),
        dry_run=dry_run,
        generated_at=datetime.now(timezone.utc),
        sandbox_summary=sandbox_summary,
    )

    _append_history(plan)
    return plan


__all__ = ["OnboardingPlan", "run_onboarding", "load_path_config"]
