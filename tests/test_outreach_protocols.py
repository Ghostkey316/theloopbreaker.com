"""Tests for outreach and protocol pilot utilities."""

from __future__ import annotations

from vaultfire.identity import GhostkeySignalBoost
from vaultfire.outreach import PartnerPitch, generate_partner_pitch, verify_partner_readiness
from vaultfire.protocols import TestnetInstance, launch_testnet_instance


def setup_function() -> None:
    GhostkeySignalBoost.clear_history()


def test_generate_partner_pitch_includes_use_case_and_highlights() -> None:
    pitch = generate_partner_pitch("openai.com", use_case="Vaultfire Trial Activation")
    assert isinstance(pitch, PartnerPitch)
    assert "Vaultfire Trial Activation" in pitch.body
    assert "OpenAI" in pitch.subject
    assert any("Passive yield" in highlight for highlight in pitch.highlights)


def test_verify_partner_readiness_thresholds() -> None:
    assert verify_partner_readiness("signal.org") is True
    assert verify_partner_readiness("humanloop.com") is False
    assert verify_partner_readiness("humanloop.com", minimum_tier="incubating") is True
    assert verify_partner_readiness("cohere.com", require_identity_anchor=True) is False


def test_launch_testnet_instance_creates_endpoints() -> None:
    instance = launch_testnet_instance("signal.org")
    assert isinstance(instance, TestnetInstance)
    assert instance.partner == "signal.org"
    assert instance.status == "active"
    assert "signal-org.vaultfire.testnet" in instance.endpoints["api"]
    assert "telemetry" in instance.endpoints


def test_launch_testnet_instance_is_idempotent() -> None:
    first = launch_testnet_instance("worldcoin.org")
    second = launch_testnet_instance("WorldCoin.org")
    assert first is second


def test_ghostkey_signal_boost_tracks_history() -> None:
    receipt = GhostkeySignalBoost.send("Test pilot broadcast", channels=["X", "ENS Relay"])
    assert receipt.message == "Test pilot broadcast"
    assert len(GhostkeySignalBoost.history()) == 1
    assert receipt.broadcast_id
