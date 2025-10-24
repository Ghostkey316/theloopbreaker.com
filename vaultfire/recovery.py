"""Recovery helpers for Vaultfire disaster recovery flows."""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any, Dict, Mapping

from vaultfire.storage import compute_checksum

SNAPSHOT_ENV = "VAULTFIRE_RECOVERY_SNAPSHOT"
SNAPSHOT_PATH = Path("backups/last_snapshot.json")

__all__ = ["RecoveryError", "load_last_snapshot", "resync_codex_memory"]


class RecoveryError(RuntimeError):
    """Raised when recovery artifacts cannot be processed."""


def _resolve_snapshot_path(path: Path | None = None) -> Path:
    if path is not None:
        return path.expanduser()
    env_value = os.environ.get(SNAPSHOT_ENV)
    if env_value:
        return Path(env_value).expanduser()
    return SNAPSHOT_PATH


def load_last_snapshot(path: Path | None = None) -> Mapping[str, Any]:
    """Load the most recent recovery snapshot manifest."""

    manifest_path = _resolve_snapshot_path(path)
    if not manifest_path.exists():
        raise FileNotFoundError(f"recovery snapshot missing at {manifest_path}")
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:  # pragma: no cover - corrupted snapshot
        raise RecoveryError(f"recovery manifest at {manifest_path} is invalid JSON") from exc
    if not isinstance(payload, dict) or "resources" not in payload:
        raise RecoveryError("recovery manifest missing resource map")
    return payload


def _copy_resource(backup: Path, target: Path, *, checksum: str | None = None) -> Dict[str, Any]:
    if not backup.exists():
        return {"status": "missing", "backup": str(backup)}
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(backup, target)
    result: Dict[str, Any] = {"status": "restored", "backup": str(backup), "target": str(target)}
    try:
        restored_checksum = compute_checksum(target)
    except OSError:
        restored_checksum = None
    if restored_checksum is not None:
        result["checksum"] = restored_checksum
        if checksum:
            result["verified"] = restored_checksum == checksum
            if not result["verified"]:
                result["status"] = "checksum_mismatch"
    return result


def resync_codex_memory(snapshot: Mapping[str, Any]) -> Mapping[str, Any]:
    """Restore codex memory, ledger state, and companion config from ``snapshot``."""

    resources = snapshot.get("resources")
    if not isinstance(resources, Mapping):
        raise RecoveryError("snapshot missing resources section")

    summary: Dict[str, Any] = {}
    for label, data in resources.items():
        if not isinstance(data, Mapping):
            summary[label] = {"status": "invalid"}
            continue
        backup_path = Path(str(data.get("backup", ""))).expanduser()
        target_path = Path(str(data.get("target") or data.get("source", ""))).expanduser()
        if not str(target_path):
            summary[label] = {"status": "invalid"}
            continue
        summary[label] = _copy_resource(backup_path, target_path, checksum=str(data.get("checksum")) or None)

    return {
        "mode": "recovery",
        "playbook": "resync_codex_memory",
        "generated_at": snapshot.get("generated_at"),
        "resources": summary,
    }
