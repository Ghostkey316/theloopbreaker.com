"""Audit storage utilities for Ghostkey-316 yield telemetry."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional


@dataclass(frozen=True)
class EnvironmentSupport:
    """Describe an environment configuration for the audit store."""

    name: str
    vaultfire_env: str
    storage_root: Path
    beta_compatible: bool = True


class AuditStorage:
    """File-backed audit store with optional fan-out hooks."""

    def __init__(
        self,
        path: Path,
        *,
        backend: str = "local_file",
        hook: Optional[Callable[[Dict], None]] = None,
        environment: Optional[EnvironmentSupport] = None,
    ) -> None:
        self.path = Path(path)
        self.backend = backend
        self._hook = hook
        self.environment = environment
        self.beta_compatible: bool = True

    def _load(self) -> List[Dict]:
        if not self.path.exists():
            return []
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

    def _write(self, payload: Iterable[Dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = list(payload)
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def append(self, entry: Dict) -> Dict:
        """Append a record and emit to optional hooks."""

        record = {
            **entry,
            "backend": self.backend,
            "beta_compatible": self.beta_compatible,
        }
        if self.environment:
            record["vaultfire_env"] = self.environment.vaultfire_env
        existing = self._load()
        existing.append(record)
        self._write(existing)
        if self._hook:
            try:
                self._hook(record)
            except Exception:
                # Hooks must never break audit persistence; swallow errors for mocks.
                pass
        return record

    def as_descriptor(self) -> Dict:
        """Provide metadata describing current storage configuration."""

        descriptor = {
            "path": str(self.path),
            "backend": self.backend,
            "beta_compatible": self.beta_compatible,
        }
        if self.environment:
            descriptor.update(
                {
                    "environment": self.environment.name,
                    "vaultfire_env": self.environment.vaultfire_env,
                }
            )
        return descriptor


LOCAL_ENVIRONMENT = EnvironmentSupport(
    name="local",
    vaultfire_env="ghostkey_testbed",
    storage_root=Path(".vaultfire/audit"),
)

CLOUD_ENVIRONMENT = EnvironmentSupport(
    name="cloud",
    vaultfire_env="prod_ready",
    storage_root=Path("/var/lib/vaultfire/audit"),
)


__all__ = [
    "AuditStorage",
    "EnvironmentSupport",
    "LOCAL_ENVIRONMENT",
    "CLOUD_ENVIRONMENT",
]
