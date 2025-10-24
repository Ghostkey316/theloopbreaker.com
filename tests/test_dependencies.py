from __future__ import annotations

from vaultfire.dependencies import SERVICE_MAP_PATH, check_service_health, load_service_map


def test_load_service_map_roundtrip(tmp_path):
    payload = {"Alpha": "active", "Beta": "planned"}
    path = tmp_path / "service_map.json"
    path.write_text("{\n  \"Alpha\": \"active\",\n  \"Beta\": \"planned\"\n}\n", encoding="utf-8")
    mapping = load_service_map(path)
    assert mapping == payload


def test_check_service_health_skips_planned(monkeypatch, tmp_path):
    mapping = load_service_map(SERVICE_MAP_PATH)

    called = []

    def _probe(service: str) -> bool:
        called.append(service)
        return service != "x402"

    healthy = check_service_health(service_map=mapping, probe=_probe)
    assert healthy is False
    assert "TimeFlare" not in called, "planned services should not be probed"
