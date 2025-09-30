from __future__ import annotations

import json
from pathlib import Path

import pytest

from vaultfire.enterprise import EnterpriseMissionControl


@pytest.fixture()
def commitments_file(tmp_path: Path) -> Path:
    data = {
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
                    }
                ],
            }
        ],
        "differentiators": [
            {"id": "mission-control-loop", "summary": "Belief-weighted mission loops broadcast confidence."}
        ],
        "observability": {"logbook": "logs/enterprise/mission_control.json", "signals": ["belief_density"]},
    }
    path = tmp_path / "mission_commitments.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


@pytest.fixture()
def mission_control(tmp_path: Path, commitments_file: Path, monkeypatch: pytest.MonkeyPatch) -> EnterpriseMissionControl:
    log_path = tmp_path / "mission_control.json"

    def fake_authorize(identity, operation, extra_tags=None):
        request = {
            "mission_tags": ["vaultfire", "enterprise"],
            "declared_purpose": identity.get("declaredPurpose"),
            "belief_density": 0.88,
            "operation_user": identity.get("wallet"),
        }
        trace = {"approved": True, "alignment_guard": {"status": "approved"}}
        return True, None, request, trace

    monkeypatch.setattr("vaultfire.enterprise.mission_control.authorize_scale", fake_authorize)
    controller = EnterpriseMissionControl(commitments_path=commitments_file, log_path=log_path)
    return controller


def test_build_enterprise_blueprint_logs_and_returns_readiness(mission_control: EnterpriseMissionControl) -> None:
    profile = {
        "wallet": "0xpartner",
        "ethicsVerified": True,
        "declaredPurpose": "Amplify ethical sports activations",
    }
    blueprint = mission_control.build_enterprise_blueprint(profile, signal_payload={"initiative": "sports.ethics.pilot"})

    assert blueprint["mission"].startswith("Belief-secured intelligence")
    assert blueprint["readiness"]["authorized"] is True
    assert blueprint["readiness"]["checklist"][0]["all_satisfied"] is True
    assert blueprint["observability"]["logbook"].endswith("mission_control.json")

    log_records = json.loads(mission_control.log_path.read_text(encoding="utf-8"))
    assert log_records, "assessment should be logged"
    assert log_records[-1]["signal_payload"] == {"initiative": "sports.ethics.pilot"}


def test_compile_alignment_checklist_handles_missing_values(mission_control: EnterpriseMissionControl) -> None:
    profile = {"wallet": "0xpartner"}
    checklist = mission_control.compile_alignment_checklist(profile)

    assert checklist[0]["all_satisfied"] is False
    assert checklist[0]["checks"][0]["observed"] == {}
