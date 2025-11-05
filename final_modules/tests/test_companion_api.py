import importlib.util
from pathlib import Path
import pytest

try:  # pragma: no cover - optional dependency gating cryptographic helpers
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - skip module when unavailable
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - executed only when dependency present
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for companion API tests",
)

try:  # optional dependency during lightweight environments
    import flask  # noqa: F401
except Exception:
    pytest.skip("flask not installed", allow_module_level=True)

MODULE_PATH = Path(__file__).resolve().parents[1] / "companion_api.py"
spec = importlib.util.spec_from_file_location("companion_api", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
if CRYPTOGRAPHY_AVAILABLE:
    spec.loader.exec_module(mod)  # type: ignore[arg-type]
    app = mod.app
else:  # pragma: no cover - placeholder when dependency missing
    app = None  # type: ignore[assignment]


def test_onboard_missing_key():
    client = app.test_client()
    resp = client.post('/companion/onboard', json={'user_id': 'alice'})
    assert resp.status_code == 400


def test_state_missing_key():
    client = app.test_client()
    resp = client.get('/companion/state/alice')
    assert resp.status_code == 400

