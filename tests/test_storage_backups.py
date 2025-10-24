from __future__ import annotations

import json

from vaultfire.storage import DailyBackupManager, compute_checksum


def test_daily_backup_manager_records_checksums(tmp_path):
    source = tmp_path / "codex.jsonl"
    source.write_text("initial", encoding="utf-8")
    manager = DailyBackupManager(base_dir=tmp_path / "backups")

    first_snapshot = manager.maybe_snapshot(source, label="codex")
    assert first_snapshot is not None
    initial_checksum = compute_checksum(first_snapshot)
    manifest = json.loads((tmp_path / "backups" / "last_snapshot.json").read_text())
    codex_entry = manifest["resources"]["codex"]
    assert codex_entry["checksum"] == initial_checksum

    # Modify the source to ensure a new checksum is captured.
    source.write_text("updated", encoding="utf-8")
    second_snapshot = manager.maybe_snapshot(source, label="codex")
    assert second_snapshot is not None
    updated_checksum = compute_checksum(second_snapshot)
    assert updated_checksum != initial_checksum
    updated_manifest = json.loads((tmp_path / "backups" / "last_snapshot.json").read_text())
    assert updated_manifest["resources"]["codex"]["checksum"] == updated_checksum
