from __future__ import annotations

import json
from pathlib import Path

from vaultfire.quantum import QuantumManifestoExporter, SelfErasureFailsafe


def _write_manifesto(tmp_path: Path) -> Path:
    dna_path = tmp_path / "manifest" / "dna_signature.json"
    dna_path.parent.mkdir(parents=True, exist_ok=True)
    dna_path.write_text(json.dumps({"dna_hash": "abc123"}, indent=2))

    exporter = QuantumManifestoExporter(dna_signature_path=dna_path)
    manifesto = exporter.build_manifesto()
    return exporter.export(manifesto, path=tmp_path / "manifest" / "vaultfire_quantum_manifesto.json")


def test_failsafe_allows_healthy_state(tmp_path: Path):
    manifesto_path = _write_manifesto(tmp_path)
    dna_path = tmp_path / "manifest" / "dna_signature.json"
    failsafe = SelfErasureFailsafe(
        manifest_path=manifesto_path,
        dna_path=dna_path,
        log_path=tmp_path / "vaultfire" / "logs" / "breach.log",
        root_dir=tmp_path,
    )

    expected_hash = failsafe.compute_manifest_hash()
    state = failsafe.monitor(expected_hash, spine_integrity=True, zk_verified=True)

    assert state.healthy is True
    assert state.breach_reason is None
    assert dna_path.exists()
    assert manifesto_path.exists()


def test_failsafe_erases_and_logs_on_breach(tmp_path: Path):
    manifesto_path = _write_manifesto(tmp_path)
    dna_path = tmp_path / "manifest" / "dna_signature.json"
    rogue_manifest = tmp_path / "rogue.manifest"
    rogue_manifest.write_text("breach")

    log_path = tmp_path / "vaultfire" / "logs" / "breach.log"
    failsafe = SelfErasureFailsafe(
        manifest_path=manifesto_path,
        dna_path=dna_path,
        log_path=log_path,
        root_dir=tmp_path,
    )

    expected_hash = "invalid"
    state = failsafe.monitor(expected_hash, spine_integrity=False, zk_verified=True)

    assert state.healthy is False
    assert "spine-integrity-failed" in state.breach_reason
    assert not dna_path.exists()
    assert not rogue_manifest.exists()
    assert state.modules_shutdown

    log_lines = log_path.read_text().strip().splitlines()
    assert log_lines
    entry = json.loads(log_lines[-1])
    assert entry["reason"]
    assert "breach.log" in str(log_path)
