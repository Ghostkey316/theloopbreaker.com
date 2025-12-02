import base64
import json
from pathlib import Path
from datetime import datetime, timedelta

import pytest

from vaultfire.memory.cli.loop_memory_cli import sign_vaultloop
from vaultfire.memory.modules.vaultproof_verifier import VaultproofVerifier


def _write_snapshot(
    tmp_path,
    *,
    belief_hash: str = "belief-1",
    alignment_hash: str | None = None,
    pop_score: float = 1.1,
    echo_pop: float | None = None,
    amplifier_boost: float = 1.25,
    echo_amp: float | None = None,
    drip_offset_minutes: int = 15,
) -> tuple[str, dict]:
    now = datetime(2024, 1, 1, 0, 0, 0)
    drip_time = now + timedelta(minutes=drip_offset_minutes)
    epoch_key = drip_time.strftime("%Y%m%d%H%M%S")

    echo_history = [
        {
            "timestamp": now.isoformat(),
            "belief_hash": belief_hash,
            "validator_score": 0.91,
            "pop_score": echo_pop if echo_pop is not None else pop_score,
            "amplifier_multiplier": echo_amp if echo_amp is not None else amplifier_boost,
        }
    ]

    alignment_hash = alignment_hash or belief_hash
    loopdrop = {
        "format": ".loopdrop",
        "persona_tag": "persona-1",
        "projected_yield_rate": 0.316,
        "amplifier_boost": amplifier_boost,
        "amplifier_tier": "sync",
        "alignment_source": {"soulprint": "soul-123", "belief_hash": alignment_hash},
        "next_drip_epoch": drip_time.isoformat(),
        "pop_score": pop_score,
    }

    vaultproof_payload = {
        "persona": "persona-1",
        "validator_score": 0.91,
        "zk_consistent": True,
        "continuity_hash": "validator-abc",
    }

    vaultloop = {
        "epoch": epoch_key,
        "soulprint": "soul-123",
        "belief_score": 0.91,
        "amplifier_tier": "sync",
        "amplifier_boost": amplifier_boost,
        "pop_score": pop_score,
        "drip_yield": 0.316,
        "echo_history": echo_history,
        "validator_id": "validator-abc",
    }

    data = {
        "soulprint": "soul-123",
        "epoch": epoch_key,
        "validator_id": "validator-abc",
        "loopdrop": loopdrop,
        "vaultproof": {
            "format": ".vaultproof",
            "payload": vaultproof_payload,
            "encoded": base64.b64encode(json.dumps(vaultproof_payload, sort_keys=True).encode()).decode(),
        },
        "vaultloop": vaultloop,
    }

    path = tmp_path / "sample.vaultloop"
    path.write_text(json.dumps(data, indent=2))
    return str(path), data


def test_signature_validation(tmp_path):
    snapshot_path, _ = _write_snapshot(tmp_path)
    key_path = tmp_path / "signing.key"
    key_path.write_bytes(b"local-key")

    signature_path = sign_vaultloop(snapshot_path, private_key=key_path)
    verifier = VaultproofVerifier()
    result = verifier.verify(snapshot_path, signature_path=signature_path, key_path=key_path)

    assert result.ok
    assert result.signature_valid
    assert not result.reasons


def test_loop_mismatch_handling(tmp_path):
    snapshot_path, _ = _write_snapshot(tmp_path, alignment_hash="other-belief")
    verifier = VaultproofVerifier()

    result = verifier.verify(snapshot_path)

    assert not result.ok
    assert "loop echo hash mismatch" in result.reasons


def test_pop_and_amplifier_audit_checks(tmp_path):
    snapshot_path, _ = _write_snapshot(
        tmp_path,
        pop_score=1.25,
        echo_pop=0.75,
        amplifier_boost=1.5,
        echo_amp=1.1,
    )
    verifier = VaultproofVerifier()

    result = verifier.verify(snapshot_path)

    assert not result.ok
    assert "PoP score inconsistency detected" in result.reasons
    assert "amplifier multiplier mismatch" in result.reasons


def test_tamper_rejection_scenarios(tmp_path):
    snapshot_path, _ = _write_snapshot(tmp_path)
    key_path = tmp_path / "tamper.key"
    key_path.write_bytes(b"sign-me")
    signature_path = sign_vaultloop(snapshot_path, private_key=key_path)

    # Tamper with the snapshot after signing
    data = json.loads(Path(snapshot_path).read_text())
    data["vaultloop"]["pop_score"] = 3.14
    Path(snapshot_path).write_text(json.dumps(data, indent=2))

    verifier = VaultproofVerifier()
    result = verifier.verify(snapshot_path, signature_path=signature_path, key_path=key_path)

    assert not result.ok
    assert not result.signature_valid
    assert "signature mismatch" in result.reasons
