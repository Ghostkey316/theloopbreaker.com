#!/usr/bin/env python3
"""Aggregate Vaultfire validation runner."""
from __future__ import annotations

import importlib
import json
from datetime import datetime
from typing import Any, Dict
import subprocess
import sys
from pathlib import Path

from python_system_validate import gather_python_files, build_graph, detect_cycles
from system_integrity_check import run_integrity_check, ALIGNMENT_PHRASE
from engine.worldcoin_layer import run_worldcoin_diagnostics
from simulate_partner_activation import activation_hook

try:
    import psutil  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    psutil = None  # type: ignore


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def python_validation() -> Dict[str, Any]:
    files = gather_python_files()
    graph, syntax_errors, suspicious = build_graph(files)
    cycles = detect_cycles(graph)
    issues = syntax_errors or suspicious or cycles
    return {
        "modules_checked": len(files),
        "syntax_errors": syntax_errors,
        "suspicious_ops": suspicious,
        "cycles": cycles,
        "status": "PASS" if not issues else "FAIL",
    }


def plugin_check(name: str) -> str:
    try:
        importlib.import_module(name)
        return "available"
    except Exception as e:  # pragma: no cover - environment variance
        return f"error: {e}"


def tests_pass() -> bool:
    """Run test suite and return ``True`` if all tests succeed."""
    cmd = [sys.executable, "-m", "pytest", "-q"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return proc.returncode == 0 and "54 passed" in proc.stdout


def fallback_present() -> bool:
    """Return ``True`` if mobile fallback modules exist."""
    return Path("update_ens_text_records.py").exists() and Path("SecureStore.py").exists()


def performance_metrics() -> Dict[str, Any]:
    if psutil is None:
        return {}
    return {
        "cpu": psutil.cpu_percent(interval=0.1),
        "memory": psutil.virtual_memory().percent,
    }


# ---------------------------------------------------------------------------
# Main routine
# ---------------------------------------------------------------------------

def run_checks() -> Dict[str, Any]:
    python_report = python_validation()
    integrity = run_integrity_check()
    privacy = run_worldcoin_diagnostics()
    plugins = {
        "openai_tools": plugin_check("partner_plugins.openai_tools"),
        "assemble_ai_services": plugin_check("partner_plugins.assemble_ai_services"),
        "worldcoin_biometric": plugin_check("partner_plugins.worldcoin_biometric"),
        "ens_cloak": plugin_check("partner_plugins.ens_cloak"),
    }
    activation = activation_hook(
        "diag_test",
        ["ghostkey316.eth"],
        ALIGNMENT_PHRASE,
        silent=True,
        test_mode=True,
    )
    result = {
        "timestamp": datetime.utcnow().isoformat(),
        "python": python_report,
        "integrity": integrity,
        "privacy": privacy,
        "plugins": plugins,
        "activation": activation["status"],
        "performance": performance_metrics(),
    }
    ok = (
        python_report["status"] == "PASS"
        and not any(integrity.values())
        and not privacy.get("issues")
        and activation["status"] == "PASS"
    )
    result["status"] = "PASS" if ok else "FAIL"
    return result


def main() -> int:
    report = run_checks()
    print(json.dumps(report, indent=2))
    if report["status"] == "PASS" and tests_pass() and fallback_present():
        print("\U0001F513 ALL SYSTEMS GO — VAULTFIRE READY FOR REAL-WORLD ACTIVATION \U0001F680")
        return 0
    if report["status"] == "PASS":
        print("Vaultfire is Activation Ready")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
