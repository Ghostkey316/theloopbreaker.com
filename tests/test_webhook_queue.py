import importlib
import json
import os
import tempfile
import time
from unittest import mock

import pytest

try:  # pragma: no cover - optional dependency for webhook queue encryption
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - skip module when unavailable
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - executed when dependency present
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for webhook queue tests",
)


def test_webhook_queue_retries():
    with tempfile.TemporaryDirectory() as tmp:
        queue_path = os.path.join(tmp, "queue.json")
        with mock.patch.dict(os.environ, {"VAULTFIRE_WEBHOOK_QUEUE": queue_path}):
            engine = importlib.reload(importlib.import_module("belief_trigger_engine"))
            engine.enqueue_webhook("http://localhost", {"ok": True})
            assert os.path.exists(queue_path)

            with mock.patch.object(engine, "_dispatch_delivery", side_effect=[Exception("boom"), True]):
                delivered = engine.process_webhook_queue(now=time.time())
                assert delivered == 0

                with open(queue_path, "r", encoding="utf-8") as handle:
                    queue = json.load(handle)
                assert queue[0]["attempts"] == 1
                next_time = queue[0]["next_attempt"]

                delivered = engine.process_webhook_queue(now=next_time + 0.1)
                assert delivered == 1

            assert not os.path.exists(queue_path)
