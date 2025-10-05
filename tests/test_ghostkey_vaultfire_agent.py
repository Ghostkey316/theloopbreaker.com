from __future__ import annotations

import json
from pathlib import Path

import pytest

from vaultfire.pilot_mode import (
    FeedbackCollector,
    PilotAccessLayer,
    PilotPrivacyLedger,
    PilotResonanceTelemetry,
    PilotSession,
    ProtocolKeyManager,
    YieldSandbox,
    GhostkeyVaultfireAgent,
    PilotAccessRegistry,
)


def _make_access_layer(tmp_path: Path) -> PilotAccessLayer:
    ledger_path = tmp_path / "ledger.jsonl"
    ledger = PilotPrivacyLedger(reference_log_path=ledger_path)
    registry = PilotAccessRegistry(path=tmp_path / "partners.json")
    key_manager = ProtocolKeyManager(path=tmp_path / "protocol_keys.json")
    sandbox = YieldSandbox(
        ledger=ledger,
        yield_log_path=tmp_path / "yield.jsonl",
        behavior_log_path=tmp_path / "behavior.jsonl",
    )
    feedback = FeedbackCollector(log_path=tmp_path / "feedback.jsonl", ledger=ledger)
    resonance = PilotResonanceTelemetry(
        ledger=ledger,
        gradient_window_seconds=600,
    )
    return PilotAccessLayer(
        registry=registry,
        key_manager=key_manager,
        sandbox=sandbox,
        feedback=feedback,
        ledger=ledger,
        resonance=resonance,
    )


def _bootstrap_session(agent: GhostkeyVaultfireAgent, *, api_key: str = "ghost-api") -> PilotSession:
    registration = agent.onboard_contributor(
        "ghost-partner",
        api_keys=[api_key],
        wallet_addresses=["0xABC"],
        metadata={"tier": "pilot"},
        watermark=True,
    )
    protocol_key = registration["protocol_key"]
    session = agent.verify_trust(
        "ghost-partner",
        protocol_key=protocol_key,
        api_key=api_key,
        protocols=("Vaultfire", "Pilot"),
    )
    session.capture_resonance_signal(
        source="edge-node",
        technique="edge-llm",
        score=0.84,
    )
    return session


def test_agent_launch_exposes_configuration(tmp_path: Path) -> None:
    access_layer = _make_access_layer(tmp_path)
    agent = GhostkeyVaultfireAgent(access_layer=access_layer)

    _bootstrap_session(agent)

    state = agent.launch(mode="pre-release", sync_with_devday_tools=True)

    assert state.mode == "pre-release"
    assert state.sync_with_devday_tools is True
    assert state.resonance_digest["signal_count"] == 1
    assert state.resonance_configuration["gradient_window_seconds"] == pytest.approx(600)
    assert "technique_breakdown" in state.resonance_configuration
    assert state.widgets["YieldDashboard"]["active"] is True
    assert agent.mission in state.mission_commitments.get("mission", agent.mission)


def test_enable_stealth_pilot_logs_mission_control(tmp_path: Path) -> None:
    access_layer = _make_access_layer(tmp_path)
    agent = GhostkeyVaultfireAgent(access_layer=access_layer)

    session = _bootstrap_session(agent)

    response = agent.enable_stealth_pilot(
        session,
        allow_confidential_sessions=True,
        grant_corporate_protocols_like_ASM_private_access=True,
        auto_expire_on_signal_mismatch=True,
    )

    assert response["session_id"] == session.session_id
    assert response["stealth"]["allow_confidential_sessions"] is True
    assert response["mission_control"]["reference_id"]

    ledger_path = tmp_path / "ledger.jsonl"
    payload = json.loads(ledger_path.read_text(encoding="utf-8").splitlines()[-1])
    assert payload["reference_type"] == "mission-control"
    assert payload["metadata"]["component"] == "resonance-telemetry"

