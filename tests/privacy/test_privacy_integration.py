from vaultfire.core import GhostkeyCLI, VaultfireProtocolStack
from vaultfire.privacy import (
    ConsentGuardianLayer,
    EchoAnonymizerEngine,
    GhostkeyPrivacyHalo,
    VaultTraceEraser,
)


def test_privacy_modules_are_integrated_and_cli_extended():
    GhostkeyCLI.reset()
    stack = VaultfireProtocolStack()

    shield = stack.privacy_shield
    assert isinstance(shield.guardian, ConsentGuardianLayer)
    assert isinstance(shield.anonymizer, EchoAnonymizerEngine)
    assert isinstance(shield.eraser, VaultTraceEraser)
    assert isinstance(shield.halo, GhostkeyPrivacyHalo)

    manifest_modules = {entry["module"] for entry in stack.integration_manifest}
    assert {"ConsentGuardianLayer", "EchoAnonymizerEngine", "VaultTraceEraser", "GhostkeyPrivacyHalo"}.issubset(
        manifest_modules
    )

    privacy_commands = stack.cli_manifest["categories"]["privacy"]
    assert {"compress", "anonymize", "consent-verify"}.issubset(set(privacy_commands))
