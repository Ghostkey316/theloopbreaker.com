import pytest

from vaultfire.legal import DisclosureShieldTrailEngine


def test_disclosure_trail_engine_records_and_seals():
    engine = DisclosureShieldTrailEngine()
    entry = engine.record("ethics", {"status": "aligned", "consent": True})
    assert entry["digest"]
    assert entry["payload"]["status"] == "aligned"

    export = engine.export()
    assert len(export) == 1

    engine.seal()
    assert engine.sealed()
    with pytest.raises(RuntimeError):
        engine.record("ethics", {"status": "update"})

    status = engine.status()
    assert status["entries"] == 1
    assert status["latest_digest"] == entry["digest"]
