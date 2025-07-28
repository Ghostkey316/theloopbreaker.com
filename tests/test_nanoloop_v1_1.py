import json
from pathlib import Path
import engine.nanoloop_v1_1 as nl


def test_cycle(monkeypatch, tmp_path):
    monkeypatch.setattr(nl, "LOG_DIR", tmp_path)
    nl.STORE = nl.SecureStore(nl.STORE_KEY, tmp_path)
    nl.activate(nl.MODULE_INFO["activation_tag"])
    res = nl.repair_cell_pattern("u1", "arm", "w1")
    assert "cid" in res
    meta_file = tmp_path / f"{res['cid']}.json"
    assert meta_file.exists()
    data = json.loads(meta_file.read_text())
    assert data["wallet"] == "w1"
