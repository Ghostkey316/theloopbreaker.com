from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

try:  # pragma: no cover - optional dependency under minimal installs
    from cryptography.exceptions import InvalidTag
except (ImportError, ModuleNotFoundError):  # pragma: no cover - graceful skip when unavailable
    CRYPTOGRAPHY_AVAILABLE = False

    class InvalidTag(Exception):
        """Placeholder for cryptography.InvalidTag when dependency is absent."""

else:  # pragma: no cover - executed only when optional dependency installed
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for SecureStore tests",
)

from utils.crypto import derive_key
from vaultfire_securestore import SecureStore


@pytest.fixture()
def sample_files(tmp_path: Path) -> list[Path]:
    files = []
    for idx in range(5):
        file_path = tmp_path / f"sample-{idx}.bin"
        file_path.write_bytes(os.urandom(32))
        files.append(file_path)
    return files


def test_validate_pipeline_throughput(tmp_path: Path, sample_files: list[Path]) -> None:
    key = derive_key('vaultfire-integration-key')
    store = SecureStore(key, tmp_path)
    payloads = [(path, f"wallet-{idx}", 'gold', idx) for idx, path in enumerate(sample_files)]

    summary = store.validate_pipeline(payloads, concurrency=3)
    assert summary['processed'] == len(sample_files)
    assert summary['throughput'] >= 0


def test_retry_pipeline_buffers_failures(tmp_path: Path, sample_files: list[Path]) -> None:
    key = derive_key('vaultfire-retry-key')
    decisions: list[dict] = []
    store = SecureStore(key, tmp_path, max_retries=1, retry_backoff=0, intent_logger=decisions.append)

    first_file = sample_files[0]
    real_attempt = store._attempt_store  # type: ignore[attr-defined]
    attempts = {'count': 0}

    def flaky_attempt(*args, **kwargs):
        attempts['count'] += 1
        if attempts['count'] == 1:
            raise IOError('transient-io')
        return real_attempt(*args, **kwargs)

    store._attempt_store = flaky_attempt  # type: ignore[assignment]
    metadata = store.encrypt_and_store(first_file, 'wallet-0', 'gold', 1)
    assert metadata['cid']
    assert any(entry['status'] == 'stored' for entry in decisions)

    # Force a permanent failure to trigger retry buffer
    def always_fail(*_args, **_kwargs):  # type: ignore[no-redef]
        raise IOError('permanent-failure')

    store._attempt_store = always_fail  # type: ignore[assignment]
    with pytest.raises(IOError):
        store.encrypt_and_store(sample_files[1], 'wallet-1', 'gold', 2)

    retries = list(store.retry_dir.glob('*.retry.json'))
    assert retries, 'retry metadata not persisted'
    payload = json.loads(retries[0].read_text())
    assert payload['error'] == 'permanent-failure'
    assert any(entry['status'] == 'retry-buffered' for entry in decisions)


def test_decrypt_rejects_tampered_metadata(tmp_path: Path) -> None:
    key = derive_key('vaultfire-metadata-guard')
    store = SecureStore(key, tmp_path)

    payload_path = tmp_path / 'payload.bin'
    payload_path.write_bytes(b'vaultfire-protocol')

    metadata = store.encrypt_and_store(payload_path, 'wallet-123', 'gold', 77)
    tampered = dict(metadata)
    tampered['wallet'] = 'wallet-spoof'
    signature_payload = {
        k: tampered[k] for k in ['wallet', 'tier', 'score', 'timestamp', 'content_hash', 'cid']
    }
    tampered['signature'] = store._sign(signature_payload)  # type: ignore[attr-defined]

    with pytest.raises(InvalidTag):
        store.decrypt(metadata['cid'], tampered)
