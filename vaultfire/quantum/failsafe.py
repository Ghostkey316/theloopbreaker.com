"""Self-erasure failsafe for Vaultfire quantum integrity breaches."""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha3_256
from pathlib import Path
from typing import Iterable


@dataclass
class FailsafeState:
    """State snapshot after a failsafe evaluation."""

    healthy: bool
    manifest_hash: str
    breach_reason: str | None
    modules_shutdown: list[str]


class SelfErasureFailsafe:
    """Monitor integrity signals and trigger erasure when misaligned."""

    def __init__(
        self,
        *,
        manifest_path: str | Path | None = None,
        dna_path: str | Path | None = None,
        log_path: str | Path | None = None,
        root_dir: str | Path | None = None,
    ) -> None:
        self.manifest_path = Path(manifest_path) if manifest_path else Path("manifest") / "vaultfire_quantum_manifesto.json"
        self.dna_path = Path(dna_path) if dna_path else Path("manifest") / "dna_signature.json"
        self.log_path = Path(log_path) if log_path else Path("vaultfire") / "logs" / "breach.log"
        self.root_dir = Path(root_dir) if root_dir else Path(".")
        self._modules_shutdown: list[str] = []

    def compute_manifest_hash(self) -> str:
        if not self.manifest_path.exists():
            return ""
        payload = self.manifest_path.read_text()
        return sha3_256(payload.encode()).hexdigest()

    def monitor(self, expected_manifest_hash: str, *, spine_integrity: bool, zk_verified: bool) -> FailsafeState:
        current_hash = self.compute_manifest_hash()
        healthy = bool(expected_manifest_hash) and current_hash == expected_manifest_hash and spine_integrity and zk_verified
        breach_reason: str | None = None
        if not healthy:
            breach_reason = self._build_reason(current_hash, expected_manifest_hash, spine_integrity, zk_verified)
            self._trigger_erasure(breach_reason)
        return FailsafeState(
            healthy=healthy,
            manifest_hash=current_hash,
            breach_reason=breach_reason,
            modules_shutdown=list(self._modules_shutdown),
        )

    def _build_reason(
        self, current_hash: str, expected_manifest_hash: str, spine_integrity: bool, zk_verified: bool
    ) -> str:
        reasons: list[str] = []
        if not expected_manifest_hash:
            reasons.append("missing-expected-manifest-hash")
        if current_hash != expected_manifest_hash:
            reasons.append("manifest-hash-mismatch")
        if not spine_integrity:
            reasons.append("spine-integrity-failed")
        if not zk_verified:
            reasons.append("zk-verification-failed")
        return ":".join(reasons)

    def _trigger_erasure(self, reason: str) -> None:
        self._erase_dna_signature()
        self._erase_manifest_files()
        self._shutdown_quantum_modules()
        self._log_breach(reason)

    def _erase_dna_signature(self) -> None:
        if self.dna_path.exists():
            self.dna_path.unlink()

    def _erase_manifest_files(self) -> None:
        for manifest_file in self._iter_manifest_files():
            try:
                manifest_file.unlink()
            except OSError:
                continue
        if self.manifest_path.exists():
            try:
                self.manifest_path.unlink()
            except OSError:
                pass

    def _iter_manifest_files(self) -> Iterable[Path]:
        yield from self.root_dir.rglob("*.manifest")

    def _shutdown_quantum_modules(self) -> None:
        for name in list(sys.modules):
            if name.startswith("vaultfire.quantum") and name not in self._modules_shutdown:
                self._modules_shutdown.append(name)
                sys.modules.pop(name, None)

    def _log_breach(self, reason: str) -> None:
        timestamp = datetime.now(timezone.utc).isoformat()
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": timestamp,
            "reason": reason,
            "manifest": str(self.manifest_path),
        }
        if self.dna_path.exists():
            entry["dna_remaining"] = True
        with self.log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(json.dumps(entry, sort_keys=True) + "\n")


__all__ = ["SelfErasureFailsafe", "FailsafeState"]
