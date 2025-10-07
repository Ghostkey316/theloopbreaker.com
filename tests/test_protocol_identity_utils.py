from protocol import ActivationResult, activate_trial_mode
from protocol.identity import IdentityManager
from protocol.tests import test_normalization as protocol_test_normalization
from protocol.tests import test_validation as protocol_test_validation
from protocol.utils import (
    governance_summary,
    guardian_attestation,
    forge_lock,
    trace_logger,
    verify_immutability,
)


def test_activate_trial_mode_with_identity_hooks():
    identity = IdentityManager.load("ghostkey316.eth")
    activation = activate_trial_mode(
        identity=identity,
        enable_telemetry=True,
        enable_signal=True,
        enable_governance=True,
        trace_hooks=[trace_logger.capture_all(), guardian_attestation.observe()],
    )

    assert isinstance(activation, ActivationResult)
    assert activation.signal_status == "enabled"
    assert activation.telemetry_status == "enabled"
    assert activation["identity"] == identity.address
    assert activation["config"]["telemetry_sinks"] == ["trace_logger"]
    assert activation["config"]["signal_trackers"] == ["trace_logger", "guardian_attestation"]
    assert {hook["name"] for hook in activation["trace_hooks"]} == {
        "trace_logger",
        "guardian_attestation",
    }


def test_forge_lock_and_governance_summary():
    identity = IdentityManager.load("ghostkey316.eth")

    assert forge_lock(identity=identity) is True
    assert verify_immutability(identity) is True

    snapshot = governance_summary(identity)
    assert snapshot.status == "synced"
    assert identity.address in snapshot.participants


def test_embedded_protocol_checks():
    assert protocol_test_normalization() is True
    assert protocol_test_validation() is True
