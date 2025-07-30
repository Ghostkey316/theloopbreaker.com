import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "companion_api.py"
spec = importlib.util.spec_from_file_location("companion_api", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)  # type: ignore
app = mod.app


def test_onboard_missing_key():
    client = app.test_client()
    resp = client.post('/companion/onboard', json={'user_id': 'alice'})
    assert resp.status_code == 400


def test_state_missing_key():
    client = app.test_client()
    resp = client.get('/companion/state/alice')
    assert resp.status_code == 400

