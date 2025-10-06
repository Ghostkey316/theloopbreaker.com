import json
from pathlib import Path

import pytest

from vaultfire import legacy


def _patch_paths(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(legacy, "_REGISTRY_PATH", tmp_path / "registry.json")
    monkeypatch.setattr(legacy, "_HISTORY_PATH", tmp_path / "history.log")


def _sample_payload(**overrides):
    payload = {
        "identity": "Ghostkey-316",
        "ENS": "ghostkey316.eth",
        "wallet": "bpow20.cb.id",
        "legacy_title": "The Face",
        "ethical_core": "Ghostkey Ethics Framework v2.0",
        "verified_contributor": True,
        "metadata_locked": False,
    }
    payload.update(overrides)
    return payload


def test_initiate_creates_registry(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    _patch_paths(monkeypatch, tmp_path)

    record = legacy.initiate_eternal_proof_layer(**_sample_payload())

    assert record["identity"] == "Ghostkey-316"
    assert record["created_at"] == record["updated_at"]
    assert (tmp_path / "registry.json").exists()

    with open(tmp_path / "registry.json") as stream:
        data = json.load(stream)
    assert "Ghostkey-316" in data
    assert data["Ghostkey-316"]["legacy_title"] == "The Face"

    with open(tmp_path / "history.log") as stream:
        history_line = stream.read().strip()
    assert history_line


def test_update_preserves_created_at(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    _patch_paths(monkeypatch, tmp_path)

    first = legacy.initiate_eternal_proof_layer(**_sample_payload())
    second = legacy.initiate_eternal_proof_layer(
        **_sample_payload(legacy_title="The Eternal Face")
    )

    assert first["created_at"] == second["created_at"]
    assert second["legacy_title"] == "The Eternal Face"


def test_locked_metadata_cannot_be_updated(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    _patch_paths(monkeypatch, tmp_path)

    legacy.initiate_eternal_proof_layer(**_sample_payload(metadata_locked=True))

    with pytest.raises(legacy.LegacyMetadataLockedError):
        legacy.initiate_eternal_proof_layer(**_sample_payload(legacy_title="Updated"))


def test_invalid_identity_raises(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    _patch_paths(monkeypatch, tmp_path)

    with pytest.raises(legacy.LegacyMetadataError):
        legacy.initiate_eternal_proof_layer(**_sample_payload(identity="   "))
