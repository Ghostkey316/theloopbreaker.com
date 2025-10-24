"""Daily backup helpers for Vaultfire operational data."""

from __future__ import annotations

import json
import shutil
import threading
from hashlib import blake2b
from datetime import datetime
from pathlib import Path
from typing import Dict, Mapping

__all__ = ["DailyBackupManager", "compute_checksum"]


def compute_checksum(path: Path) -> str:
    """Return the BLAKE2b checksum for ``path``.

    The helper uses a deterministic digest so that backup manifests can
    validate copied artifacts against the Codex checksum requirements.
    """

    hasher = blake2b(digest_size=32)
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


class DailyBackupManager:
    """Maintain rotating daily backups for critical runtime artifacts."""

    def __init__(self, *, base_dir: Path | None = None, retention_days: int = 14) -> None:
        self.base_dir = (base_dir or Path("backups")).expanduser()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.daily_dir = self.base_dir / "daily"
        self.daily_dir.mkdir(parents=True, exist_ok=True)
        self.retention_days = max(1, int(retention_days))
        self._state_path = self.base_dir / "state.json"
        self._manifest_path = self.base_dir / "last_snapshot.json"
        self._lock = threading.RLock()
        self._state = self._load_state()

    def _load_state(self) -> Dict[str, Mapping[str, str]]:
        if self._state_path.exists():
            try:
                payload = json.loads(self._state_path.read_text(encoding="utf-8"))
                entries = payload.get("entries") if isinstance(payload, dict) else None
                if isinstance(entries, dict):
                    return {key: dict(value) for key, value in entries.items() if isinstance(value, dict)}
            except json.JSONDecodeError:
                return {}
        return {}

    def _save_state(self) -> None:
        payload = {"entries": self._state}
        self._state_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

    def _write_manifest(self) -> None:
        generated_at = datetime.utcnow().isoformat() + "Z"
        resources = {}
        for key, entry in self._state.items():
            resources[key] = {
                "backup": entry.get("backup"),
                "target": entry.get("target"),
                "source": entry.get("source"),
                "date": entry.get("date"),
                "checksum": entry.get("checksum"),
            }
        manifest = {"generated_at": generated_at, "resources": resources}
        self._manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")

    def _purge_old_snapshots(self) -> None:
        daily_dirs = sorted(path for path in self.daily_dir.iterdir() if path.is_dir())
        if len(daily_dirs) <= self.retention_days:
            return
        for path in daily_dirs[: len(daily_dirs) - self.retention_days]:
            shutil.rmtree(path, ignore_errors=True)

    def maybe_snapshot(self, source: Path, *, label: str | None = None) -> Path | None:
        """Capture a snapshot of ``source`` if one has not been stored today."""

        source = source.expanduser()
        if not source.exists() or not source.is_file():
            return None

        tag = label or source.stem
        today = datetime.utcnow().strftime("%Y-%m-%d")
        state_entry = self._state.get(tag)
        if state_entry and state_entry.get("date") == today:
            backup_path = Path(state_entry.get("backup", ""))
            if backup_path.exists():
                # Skip when the checksum still matches the source artefact.
                try:
                    current_checksum = compute_checksum(source)
                except OSError:
                    current_checksum = None
                if current_checksum and current_checksum == state_entry.get("checksum"):
                    return backup_path

        with self._lock:
            day_dir = self.daily_dir / today
            day_dir.mkdir(parents=True, exist_ok=True)
            destination = day_dir / f"{tag}{source.suffix or ''}"
            shutil.copy2(source, destination)
            checksum = compute_checksum(destination)
            self._state[tag] = {
                "date": today,
                "backup": str(destination),
                "source": str(source),
                "target": str(source),
                "checksum": checksum,
            }
            self._save_state()
            self._write_manifest()
            self._purge_old_snapshots()
            return destination
