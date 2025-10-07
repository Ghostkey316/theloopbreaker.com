from vaultfire.core import (
    EnhancementConfirmComposer,
    GhostkeyCLI,
    TemporalBehavioralCompressionEngine,
    VaultfireProtocolStack,
)


def test_protocol_integration_manifest_and_architect(tmp_path):
    GhostkeyCLI.reset()
    EnhancementConfirmComposer.sync_with([])
    manifest = VaultfireProtocolStack.integrate([TemporalBehavioralCompressionEngine])
    assert manifest
    assert manifest[0]["module"] == "TemporalBehavioralCompressionEngine"

    stack = VaultfireProtocolStack(mythos_path=str(tmp_path / "mythos.json"))
    modules = {entry["module"] for entry in stack.integration_manifest}
    assert "TemporalBehavioralCompressionEngine" in modules

    assignment = VaultfireProtocolStack.assign_architect("ghostkey316.eth")
    assert assignment["architect"] == "ghostkey316.eth"
    assert VaultfireProtocolStack.architect() == "ghostkey316.eth"
    assert VaultfireProtocolStack.architect_history()

    status = EnhancementConfirmComposer.status()
    assert status["sources"] is not None
