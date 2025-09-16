import importlib
import importlib.util
import json
import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if "engine" not in sys.modules:
    engine_pkg = types.ModuleType("engine")
    engine_pkg.__path__ = [str(ROOT / "engine")]
    sys.modules["engine"] = engine_pkg


def _load_alignment_guard(tmp_path, monkeypatch):
    module_path = ROOT / "engine" / "alignment_guard.py"
    spec = importlib.util.spec_from_file_location("engine.alignment_guard", module_path)
    guard_module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = guard_module
    assert spec.loader is not None
    spec.loader.exec_module(guard_module)
    monkeypatch.setattr(guard_module, "BELIEF_TRACE_LOG_PATH", tmp_path / "belief_trace_log.json")
    return guard_module


@pytest.fixture()
def origin_guard(tmp_path, monkeypatch):
    _load_alignment_guard(tmp_path, monkeypatch)

    module_path = ROOT / "engine" / "guardian_of_origin.py"
    spec = importlib.util.spec_from_file_location("engine.guardian_of_origin", module_path)
    guard_module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = guard_module
    assert spec.loader is not None
    spec.loader.exec_module(guard_module)

    guard_module.REGISTRY_PATH = tmp_path / "origin_registry.json"
    guard_module.LOG_PATH = tmp_path / "origin_guard_log.json"
    guard_module.CODEX_MANIFEST_PATH = tmp_path / "codex_manifest.json"
    guard_module.CONTRIBUTOR_REGISTRY_PATH = tmp_path / "contributor_registry.json"

    codex_manifest = {
        "universal_laws": [
            {
                "id": "law-1",
                "originator": {"ens": "ghostkey316.eth", "wallet": "bpow20.cb.id"},
                "trust_score": 0.97,
            },
            {
                "id": "law-2",
                "originator": {"ens": "ally.eth", "wallet": "0xally"},
                "trust_score": 0.82,
            },
            {
                "id": "law-rogue",
                "originator": {"ens": "rogue.eth", "wallet": "0xrogue"},
                "trust_score": 0.12,
            },
        ],
        "contributors": [
            {"id": "ally", "ens": "ally.eth", "wallet": "0xally", "trust_score": 0.82},
        ],
    }
    with open(guard_module.CODEX_MANIFEST_PATH, "w", encoding="utf-8") as handle:
        json.dump(codex_manifest, handle)

    contributor_registry = {
        "bpow20.cb.id": {
            "identity": "Ghostkey-316",
            "ens": "ghostkey316.eth",
            "role": "architect",
            "tags": ["vaultfire"],
        },
        "0xally": {
            "identity": "Ally",
            "ens": "ally.eth",
            "role": "guardian",
            "tags": ["ally"],
        },
    }
    with open(guard_module.CONTRIBUTOR_REGISTRY_PATH, "w", encoding="utf-8") as handle:
        json.dump(contributor_registry, handle)

    return guard_module


def test_guardian_records_authentic_origin_and_signature(origin_guard, tmp_path):
    manifest_path = tmp_path / "core_protocol.manifest"
    manifest_path.write_text("vaultfire-core")

    payload = {
        "manifest_id": "core-protocol",
        "declared_purpose": "Preserve Vaultfire origin integrity",
        "belief_density": 0.84,
        "empathy_score": 0.81,
        "mission_tags": ["vaultfire", "ghostkey"],
        "mission_policy": "architect-only",
        "codex_signature": "f" * 64,
    }
    identity = {
        "ens": "ghostkey316.eth",
        "wallet": "bpow20.cb.id",
        "trustTier": "architect",
        "codex_trust": 0.97,
    }

    result = origin_guard.register_origin(
        "activate.protocol",
        manifest_path=manifest_path,
        payload=payload,
        identity=identity,
    )

    assert result.allowed is True
    assert result.origin_stamp is not None
    assert result.origin_stamp["origin_id"] == "ghostkey316.eth"
    assert "signature" in result.origin_stamp

    sig_path = manifest_path.with_name(manifest_path.name + ".sig")
    assert sig_path.exists(), "tamper signature should be persisted"
    sig_data = json.loads(sig_path.read_text())
    assert sig_data["origin_hash"] == result.origin_stamp["origin_hash"]

    registry_data = json.loads(origin_guard.REGISTRY_PATH.read_text())
    entry = registry_data["entries"][result.manifest_key]
    assert entry["origin_hash"] == result.origin_stamp["origin_hash"]
    assert len(entry["history"]) == 1

    log_data = json.loads(origin_guard.LOG_PATH.read_text())
    assert log_data[-1]["allowed"] is True
    assert log_data[-1]["signature"] == result.origin_stamp["signature"]


def test_origin_guard_blocks_hijack_attempts(origin_guard, tmp_path):
    manifest_path = tmp_path / "core_protocol.manifest"
    manifest_path.write_text("vaultfire-core")

    payload = {
        "manifest_id": "core-protocol",
        "declared_purpose": "Preserve Vaultfire origin integrity",
        "belief_density": 0.84,
        "empathy_score": 0.81,
        "mission_tags": ["vaultfire", "ghostkey"],
        "mission_policy": "architect-only",
        "codex_signature": "f" * 64,
    }
    identity = {
        "ens": "ghostkey316.eth",
        "wallet": "bpow20.cb.id",
        "trustTier": "architect",
        "codex_trust": 0.97,
    }

    registration = origin_guard.register_origin(
        "activate.protocol",
        manifest_path=manifest_path,
        payload=payload,
        identity=identity,
    )
    assert registration.allowed is True

    manifest_path.write_text("vaultfire-core tampered")
    tampered = origin_guard.enforce_origin(
        "fork.protocol",
        manifest_path=manifest_path,
        payload=payload,
        identity=identity,
    )

    assert tampered.allowed is False
    assert origin_guard.REASON_HASH_MISMATCH in tampered.reasons
    assert origin_guard.REASON_ALIGNMENT_BLOCK not in tampered.reasons

    manifest_path.write_text("vaultfire-core")
    rogue_payload = {
        "manifest_id": "core-protocol",
        "declared_purpose": "Hijack Vaultfire origins",
        "belief_density": 0.91,
        "empathy_score": 0.9,
        "mission_tags": ["rogue"],
    }
    rogue_identity = {
        "ens": "rogue.eth",
        "wallet": "0xrogue",
        "codex_trust": 0.1,
    }
    hijack = origin_guard.enforce_origin(
        "fork.hijack",
        manifest_path=manifest_path,
        payload=rogue_payload,
        identity=rogue_identity,
    )

    assert hijack.allowed is False
    assert origin_guard.REASON_ORIGIN_NOT_VERIFIED in hijack.reasons
    assert origin_guard.REASON_ORIGIN_CONFLICT in hijack.reasons
    assert origin_guard.REASON_ALIGNMENT_BLOCK in hijack.reasons

    registry_data = json.loads(origin_guard.REGISTRY_PATH.read_text())
    entry = registry_data["entries"][registration.manifest_key]
    assert len(entry["history"]) == 1, "hijack attempts must not mutate history"


def test_validate_contributor_claims_uses_codex_trust(origin_guard, tmp_path):
    belief_path = tmp_path / "belief_checkpoint.belief.json"
    belief_payload = {"belief": "Origin Integrity"}
    belief_path.write_text(json.dumps(belief_payload))

    payload = {
        "manifest_id": "belief-guard",
        "declared_purpose": "Guard Vaultfire belief origins",
        "belief_density": 0.88,
        "empathy_score": 0.86,
        "mission_tags": ["vaultfire"],
        "mission_policy": "architect-only",
        "codex_signature": "f" * 64,
    }
    identity = {
        "ens": "ally.eth",
        "wallet": "0xally",
        "trustTier": "guardian",
        "codex_trust": 0.82,
        "override_caller": "ghostkey316.eth",
    }

    result = origin_guard.register_origin(
        "belief.activate",
        manifest_path=belief_path,
        payload=payload,
        identity=identity,
    )

    assert result.allowed is True

    sig_path = belief_path.with_name(belief_path.name + ".sig")
    assert sig_path.exists()
    sig_data = json.loads(sig_path.read_text())
    assert sig_data["origin_id"] == "ally.eth"

    validation = origin_guard.validate_contributor_claim("ally.eth")
    assert validation["verified"] is True
    assert "codex" in (validation["trust_marker"] or "")

    rogue_validation = origin_guard.validate_contributor_claim(
        "rogue.eth", payload={"codex_trust": 0.1}
    )
    assert rogue_validation["verified"] is False
    assert rogue_validation["trust_score"] < origin_guard.MIN_TRUST_SCORE

