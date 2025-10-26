"""Codex compatibility validation utilities."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List


@dataclass
class ValidationResult:
    name: str
    passed: bool
    details: Dict[str, object]


class EnterpriseCodexValidator:
    """Runs a collection of sanity checks for enterprise readiness."""

    def __init__(self, repo_root: Path | None = None) -> None:
        self.repo_root = repo_root or Path.cwd()
        self.codex_manifest = self.repo_root / "codex_manifest.json"
        self.partner_onboard = self.repo_root / "onboarding/enterprise_partner_template.md"
        self.telemetry_dashboard = self.repo_root / "telemetry/enterprise/enterprise_dashboard.json"
        self.cross_chain_report = self.repo_root / "integration/artifacts/cross_chain_sync.json"

    def _load_manifest(self) -> Dict[str, object]:
        return json.loads(self.codex_manifest.read_text(encoding="utf-8"))

    def validate_wallet_bindings(self) -> ValidationResult:
        manifest = self._load_manifest()
        contributor = manifest.get("contributor_identity", {})
        ens = contributor.get("ens")
        wallet = contributor.get("wallet")
        passed = ens == "ghostkey316.eth" and wallet == "bpow20.cb.id"
        return ValidationResult(
            name="wallet_bindings",
            passed=passed,
            details={"ens": ens, "wallet": wallet},
        )

    def validate_module_presence(self) -> ValidationResult:
        required_modules = [
            "belief-engine",
            "loyalty_engine.py",
            "ghostkey_cli.py",
            "vaultfire_cli",
        ]
        missing = []
        for module in required_modules:
            path = self.repo_root / module
            if not path.exists():
                missing.append(module)
        return ValidationResult(
            name="module_presence",
            passed=not missing,
            details={"missing": missing},
        )

    def validate_partner_handshake(self) -> ValidationResult:
        passed = self.partner_onboard.exists()
        return ValidationResult(
            name="partner_onboarding",
            passed=passed,
            details={"path": str(self.partner_onboard)},
        )

    def validate_cross_chain_sync(self) -> ValidationResult:
        passed = self.cross_chain_report.exists()
        payload: Dict[str, object] = {}
        if passed:
            payload = json.loads(self.cross_chain_report.read_text(encoding="utf-8"))
        return ValidationResult(
            name="cross_chain_sync",
            passed=passed,
            details=payload,
        )

    def run(self) -> List[ValidationResult]:
        return [
            self.validate_wallet_bindings(),
            self.validate_module_presence(),
            self.validate_partner_handshake(),
            self.validate_cross_chain_sync(),
        ]

    def overall_status(self) -> bool:
        results = self.run()
        return all(result.passed for result in results)


__all__ = ["EnterpriseCodexValidator", "ValidationResult"]
