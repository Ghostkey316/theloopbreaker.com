"""Codex validation utilities for privacy enhanced Vaultfire builds."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping, MutableSequence, Sequence

from vaultfire.noir_plugins import discover_plugins
from vaultfire.trust import load_receipts

__all__ = ["CodexChecker", "main"]


@dataclass(slots=True)
class ValidationReport:
    """Aggregate validation results."""

    noir_plugins: MutableSequence[str] = field(default_factory=list)
    receipts: MutableSequence[str] = field(default_factory=list)
    ledgers: MutableSequence[str] = field(default_factory=list)

    def as_dict(self) -> Mapping[str, Sequence[str]]:
        return {
            "noir_plugins": list(self.noir_plugins),
            "receipts": list(self.receipts),
            "ledgers": list(self.ledgers),
        }


class CodexChecker:
    """Validate Noir plugins and ZK receipt data."""

    def __init__(self, *, base_path: Path | None = None) -> None:
        self._base_path = base_path or Path.cwd()
        self._report = ValidationReport()

    def run(self) -> ValidationReport:
        self._validate_noir_plugins()
        self._validate_receipts()
        self._validate_private_ledger()
        return self._report

    # ------------------------------------------------------------------
    # Noir
    # ------------------------------------------------------------------
    def _validate_noir_plugins(self) -> None:
        plugins = discover_plugins(self._base_path / "vaultfire" / "noir_plugins")
        if not plugins:
            self._report.noir_plugins.append("noir_plugins:missing")
            return
        for plugin in plugins:
            plugin.validate()
            self._report.noir_plugins.append(f"{plugin.name}:ok")

    # ------------------------------------------------------------------
    # Receipts
    # ------------------------------------------------------------------
    def _validate_receipts(self) -> None:
        receipts = load_receipts()
        for entry in receipts:
            if not entry.get("proof_hash"):
                raise ValueError("Receipt missing proof_hash")
            if not entry.get("outcome"):
                raise ValueError("Receipt missing outcome")
            if not entry.get("timestamp"):
                raise ValueError("Receipt missing timestamp")
        self._report.receipts.append(f"count:{len(receipts)}")

    # ------------------------------------------------------------------
    # Ledger
    # ------------------------------------------------------------------
    def _validate_private_ledger(self) -> None:
        ledger_path = self._base_path / "vaultfire" / "pools" / "private_ledger.json"
        if not ledger_path.exists():
            self._report.ledgers.append("private_ledger:missing")
            return
        data = json.loads(ledger_path.read_text(encoding="utf-8"))
        if "pools" not in data:
            raise ValueError("private_ledger.json missing pools key")
        self._report.ledgers.append(f"pools:{len(data['pools'])}")


def main() -> None:
    report = CodexChecker().run()
    print(json.dumps(report.as_dict(), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
