import copy
from datetime import datetime

import pytest

from protocol import TrialModeActivationError, activate_trial_mode


@pytest.fixture()
def forge_config():
    return {
        "telemetry_sinks": ["mirrorframe_logger", "guardian_attest"],
        "signal_trackers": ["IntentPath", "SignalForker", "LoopScanner"],
        "yield_engine": {
            "enable_retro_mode": True,
            "multiplier_sim": "live_belief",
            "rewards_enabled": True,
            "epoch_streaming": True,
        },
        "mesh_layer": {
            "detect_ghostkey": True,
            "enable_hidden_paths": True,
            "prophecy_trigger": True,
        },
        "governance_scrutiny": "sandbox_ready",
        "traffic_simulation": "Ghostfire Real",
        "auth_by": "GhostKey-316",
    }


def test_activate_trial_mode_success(forge_config, identity):
    requested_identity = identity or "ghostkey316.eth"
    result = activate_trial_mode(
        identity=requested_identity,
        wallet_id="bpow20.cb.id",
        trial_codename="ForgeTrail: Ghostfire Path",
        config=forge_config,
    )

    assert result["status"] == "activated"
    assert result["identity"] == requested_identity
    assert result["wallet_id"] == "bpow20.cb.id"
    assert result["config"]["yield_engine"]["multiplier_sim"] == "live_belief"
    assert result["flags"]["rewards_preview"] is True
    assert result["telemetry"]["sinks"] == ["mirrorframe_logger", "guardian_attest"]
    assert result["signals"]["loop_scanner_active"] is True
    assert result["governance"]["scrutiny"] == "sandbox_ready"
    # the timestamp should be ISO formatted and convertible back
    datetime.fromisoformat(result["activated_at"].replace("Z", "+00:00"))
    assert "ForgeTrail: Ghostfire Path" in result["summary"]


def test_activate_trial_mode_does_not_mutate_original_config(forge_config, identity):
    requested_identity = identity or "ghostkey316.eth"
    config = copy.deepcopy(forge_config)
    config["telemetry_sinks"].append("mirrorframe_logger")  # duplicate entry
    result = activate_trial_mode(
        identity=requested_identity,
        wallet_id="bpow20.cb.id",
        trial_codename="ForgeTrail: Ghostfire Path",
        config=config,
    )

    # original config should still contain the duplicate entry
    assert config["telemetry_sinks"].count("mirrorframe_logger") == 2
    # normalized config should only contain unique entries in order
    assert result["config"]["telemetry_sinks"] == ["mirrorframe_logger", "guardian_attest"]


def test_activate_trial_mode_missing_required_section_raises(forge_config, identity):
    config = copy.deepcopy(forge_config)
    config.pop("telemetry_sinks")

    with pytest.raises(TrialModeActivationError):
        activate_trial_mode(
            identity=identity or "ghostkey316.eth",
            wallet_id="bpow20.cb.id",
            trial_codename="ForgeTrail: Ghostfire Path",
            config=config,
        )


def test_activate_trial_mode_requires_non_empty_identity(forge_config):
    with pytest.raises(TrialModeActivationError):
        activate_trial_mode(
            identity=" ",
            wallet_id="bpow20.cb.id",
            trial_codename="ForgeTrail: Ghostfire Path",
            config=forge_config,
        )
