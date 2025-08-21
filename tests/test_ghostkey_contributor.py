import json
from pathlib import Path
import ghostkey_asm_sync as gas


def setup_tmp(monkeypatch, tmp_path):
    log_path = tmp_path / "immutable_log.jsonl"
    retro_path = tmp_path / "retro_yield.json"
    reg_path = tmp_path / "contributor_registry.json"
    monkeypatch.setattr(gas, "LOG_PATH", log_path)
    monkeypatch.setattr(gas, "RETRO_YIELD_PATH", retro_path)
    monkeypatch.setattr(gas, "CONTRIB_REG_PATH", reg_path)
    # copy loyalty tiers
    (tmp_path / "loyalty_tiers.json").write_text(Path("loyalty_tiers.json").read_text())
    monkeypatch.chdir(tmp_path)


def test_contributor_flow(monkeypatch, tmp_path):
    setup_tmp(monkeypatch, tmp_path)

    gas.syncToASM()
    verification = gas.verifyImmutableSync()
    assert verification["verified"]

    retro = gas.runRetroDrop(gas.WALLET)
    assert retro["yield"] >= 0
    assert Path(gas.RETRO_YIELD_PATH).exists()

    role = gas.grantContributorRole()
    assert role["eligible"]
    registry = json.loads(Path(gas.CONTRIB_REG_PATH).read_text())
    assert gas.WALLET in registry

    proof = gas.outputProof()
    assert Path(proof["proof"]).exists()
