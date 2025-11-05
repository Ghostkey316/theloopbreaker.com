from __future__ import annotations

import importlib
import sys
import types

import pytest

try:  # pragma: no cover - optional HTTP client in minimal installs
    import requests  # type: ignore  # noqa: F401
except ModuleNotFoundError:  # pragma: no cover - skip when dependency missing
    REQUESTS_AVAILABLE = False
else:  # pragma: no cover - executed only when dependency present
    REQUESTS_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not REQUESTS_AVAILABLE,
    reason="[optional] requests is required for Vaultfire demo tests",
)


def test_load_live_health_fallback(monkeypatch):
    calls: dict[str, object] = {}

    stub = types.ModuleType("streamlit")

    def fake_cache_data(**kwargs):
        calls.update(kwargs)

        def decorator(func):
            return func

        return decorator

    stub.cache_data = fake_cache_data  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "streamlit", stub)

    go_stub = types.ModuleType("plotly.graph_objects")
    go_stub.Figure = object  # type: ignore[assignment]
    go_stub.Heatmap = lambda **kwargs: ("heatmap", kwargs)
    go_stub.Histogram = lambda **kwargs: ("histogram", kwargs)
    subplot_stub = types.ModuleType("plotly.subplots")

    class DummyFig:
        def __init__(self) -> None:
            self.calls: list[tuple[str, tuple, dict]] = []

        def add_trace(self, *args, **kwargs) -> None:
            self.calls.append(("add_trace", args, kwargs))

        def update_layout(self, **kwargs) -> None:  # noqa: D401 - test stub
            self.calls.append(("update_layout", (), kwargs))

    subplot_stub.make_subplots = lambda **_kwargs: DummyFig()
    plotly_stub = types.ModuleType("plotly")
    monkeypatch.setitem(sys.modules, "plotly", plotly_stub)
    monkeypatch.setitem(sys.modules, "plotly.graph_objects", go_stub)
    monkeypatch.setitem(sys.modules, "plotly.subplots", subplot_stub)

    px_stub = types.ModuleType("plotly.express")
    px_stub.colors = types.SimpleNamespace(qualitative=types.SimpleNamespace(Safe=["#fff"] * 10))
    monkeypatch.setitem(sys.modules, "plotly.express", px_stub)

    mpl_stub = types.ModuleType("matplotlib")
    pyplot_stub = types.ModuleType("matplotlib.pyplot")

    def _subplots(*_args, **_kwargs):
        axis = types.SimpleNamespace(
            hist=lambda *a, **k: None,
            axvline=lambda *a, **k: None,
            set_title=lambda *a, **k: None,
            set_xlabel=lambda *a, **k: None,
            set_ylabel=lambda *a, **k: None,
            legend=lambda *a, **k: None,
            text=lambda *a, **k: None,
        )
        fig = types.SimpleNamespace(suptitle=lambda *a, **k: None)
        return fig, (axis, axis)

    pyplot_stub.switch_backend = lambda *a, **k: None
    pyplot_stub.subplots = _subplots
    pyplot_stub.savefig = lambda *a, **k: None
    pyplot_stub.show = lambda *a, **k: None
    pyplot_stub.close = lambda *a, **k: None
    monkeypatch.setitem(sys.modules, "matplotlib", mpl_stub)
    monkeypatch.setitem(sys.modules, "matplotlib.pyplot", pyplot_stub)
    module = importlib.import_module("demos.vaultfire_demo")

    def boom(*_args, **_kwargs):
        raise module.requests.RequestException("boom")

    monkeypatch.setattr(module.requests, "get", boom)
    monkeypatch.setattr(module.live_oracle, "get_live_oracle", lambda: types.SimpleNamespace(health_status=lambda: {"status": "ok"}))

    health = module.load_live_health("http://api")
    assert health == {"status": "ok"}
    assert calls["ttl"] == module.CACHE_TTL

    monkeypatch.delitem(sys.modules, "demos.vaultfire_demo", raising=False)
    monkeypatch.delitem(sys.modules, "streamlit", raising=False)
