import tempfile
from pathlib import Path

import pytest

try:  # pragma: no cover - optional dependency powering secure upload
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - skip module when unavailable
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - executed when dependency present
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for vaultfire secure upload pipeline tests",
)

if CRYPTOGRAPHY_AVAILABLE:
    from secure_upload import create_store, upload_file
else:  # pragma: no cover - placeholders when dependency missing
    create_store = upload_file = None  # type: ignore[assignment]


def test_upload_pipeline(tmp_path):
    store = create_store(b"0" * 32, tmp_path / "bucket")
    src = tmp_path / "test.bin"
    src.write_bytes(b"GPSDATA")
    meta = upload_file(store, src, "w1", "Spark", 5, webhook=None, chain_log=False)
    assert (tmp_path / "bucket" / f"{meta['cid']}.bin").exists()
