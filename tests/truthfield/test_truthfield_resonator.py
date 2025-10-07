from vaultfire.consciousness import TruthfieldResonator


def test_truthfield_resonator_flags_bias_and_tracks_sources():
    resonator = TruthfieldResonator(tolerance=0.15)
    sources = resonator.calibrate_sources(["ledger", "social", "ledger"])
    assert sources == ("ledger", "social")

    snapshot = resonator.scan(
        statement="Partner alignment briefing",
        confidence=0.9,
        source="social",
        source_bias=0.35,
        tags=("speculative",),
        contradictions=("ledger mismatch",),
    )

    assert snapshot["source"] == "social"
    assert snapshot["bias_index"] > 0.0
    assert snapshot["integrity_score"] < 0.9
    assert snapshot["misinformation"] is True

    status = resonator.status()
    assert status["last_snapshot"]["statement"] == "Partner alignment briefing"
    assert "social" in status["sources"]
