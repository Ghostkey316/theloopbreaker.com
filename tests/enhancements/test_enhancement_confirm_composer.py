from vaultfire.core import (
    ConscienceMirrorVerificationLayer,
    EnhancementConfirmComposer,
    LoopSingularityDetectorEngine,
    QuantumDriftSynchronizer,
    TemporalBehavioralCompressionEngine,
    VaultfireMythosEngine,
)


def test_enhancement_confirm_composer_sync_and_compose(tmp_path):
    EnhancementConfirmComposer.sync_with(["PulsewatchMetrics", "EthicsValidationHash"])
    EnhancementConfirmComposer.annotate(environment="test-suite")

    mythos_path = tmp_path / "mythos.json"
    mythos = VaultfireMythosEngine(
        identity_handle="test-handle",
        identity_ens="test.eth",
        output_path=str(mythos_path),
    )

    payload = EnhancementConfirmComposer.compose(
        TemporalBehavioralCompressionEngine(identity_handle="test-handle", identity_ens="test.eth"),
        ConscienceMirrorVerificationLayer(identity_handle="test-handle", identity_ens="test.eth"),
        LoopSingularityDetectorEngine(identity_handle="test-handle", identity_ens="test.eth"),
        QuantumDriftSynchronizer(identity_handle="test-handle", identity_ens="test.eth"),
        mythos,
        extra={"suite": "vaultfire-v6"},
    )

    sources = payload["confirmation_sources"]
    assert sources["sources"] == ["PulsewatchMetrics", "EthicsValidationHash"]
    assert sources["checksum"]
    assert payload["suite"] == "vaultfire-v6"
    status = EnhancementConfirmComposer.status()
    assert status["sources"] == ["PulsewatchMetrics", "EthicsValidationHash"]
    assert status["checksum"] == sources["checksum"]
