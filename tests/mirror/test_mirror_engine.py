from vaultfire.core.mirror_engine import MirrorEngine


def test_records_symmetry_and_meta_state():
    engine = MirrorEngine(token_id="316")
    record = engine.record_interaction(
        session_id="session-1",
        prompt="Reflect on the trust anchor",
        response="Trust anchor acknowledged and reflected",
    )

    assert 0 <= record.mirror_score <= 316
    assert record.symmetry > 0
    assert engine.meta_state()["token_id"] == "316"

    obfuscated = list(engine.obfuscated_replay("session-1"))
    assert obfuscated
    assert obfuscated[0]["prompt"] != record.prompt

