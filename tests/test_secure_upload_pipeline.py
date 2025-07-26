import tempfile
from pathlib import Path
from secure_upload import create_store, upload_file


def test_upload_pipeline(tmp_path):
    store = create_store(b"0" * 32, tmp_path / "bucket")
    src = tmp_path / "test.bin"
    src.write_bytes(b"GPSDATA")
    meta = upload_file(store, src, "w1", "Spark", 5, webhook=None, chain_log=False)
    assert (tmp_path / "bucket" / f"{meta['cid']}.bin").exists()
