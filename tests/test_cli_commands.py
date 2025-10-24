"""Integration tests for the Vaultfire CLI."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys


def _run_cli(*args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    command = [sys.executable, "-m", "vaultfire_cli", *args]
    return subprocess.run(command, capture_output=True, text=True, env=env)


def _extract_json(stdout: str) -> dict[str, object]:
    clean = re.sub(r"\x1b\[[0-9;]*m", "", stdout)
    start = clean.find("{")
    assert start >= 0, f"no json payload found in {stdout!r}"
    json_text = clean[start:].strip()
    return json.loads(json_text)


def test_deploy_command_outputs_payload() -> None:
    result = _run_cli("deploy", "--profile", "ghostkey316.eth")
    assert result.returncode == 0, result.stderr
    payload = _extract_json(result.stdout)
    assert "ghost_signature" in payload


def test_fade_command_returns_signature() -> None:
    result = _run_cli("fade", "--persona", "ghostkey316.eth")
    assert result.returncode == 0
    assert "Fade signature" in result.stdout


def test_drift_command_reports_sanctum_data() -> None:
    result = _run_cli("drift", "--simulate", "0.1-0.9")
    assert result.returncode == 0
    payload = _extract_json(result.stdout)
    assert "sanctum" in payload
    assert payload["sanctum"]["exposure_count"] == 1


def test_cloak_status_reports_modules() -> None:
    result = _run_cli("cloak", "--status")
    assert result.returncode == 0
    payload = _extract_json(result.stdout)
    assert "ultrashadow" in payload and "belief_fingerprint" in payload


def test_test_command_skips_when_nested_pytest() -> None:
    env = dict(os.environ)
    env["PYTEST_CURRENT_TEST"] = "tests/test_cli_commands.py::test_test_command_skips_when_nested_pytest"
    result = _run_cli("test", "--all", env=env)
    assert result.returncode == 0
    assert "nested pytest session" in result.stdout


def test_recover_command_restores_snapshot(tmp_path) -> None:
    codex_backup = tmp_path / "codex.jsonl"
    ledger_backup = tmp_path / "ledger.jsonl"
    companion_backup = tmp_path / "companion.jsonl"
    codex_backup.write_text("codex-backup", encoding="utf-8")
    ledger_backup.write_text("ledger-backup", encoding="utf-8")
    companion_backup.write_text("companion-backup", encoding="utf-8")

    codex_target = tmp_path / "restore" / "codex.jsonl"
    ledger_target = tmp_path / "restore" / "ledger.jsonl"
    companion_target = tmp_path / "restore" / "companion.jsonl"
    codex_target.parent.mkdir(parents=True, exist_ok=True)
    ledger_target.parent.mkdir(parents=True, exist_ok=True)
    companion_target.parent.mkdir(parents=True, exist_ok=True)
    codex_target.write_text("stale", encoding="utf-8")
    ledger_target.write_text("stale", encoding="utf-8")
    companion_target.write_text("stale", encoding="utf-8")

    snapshot = tmp_path / "last_snapshot.json"
    snapshot.write_text(
        json.dumps(
            {
                "generated_at": "2024-07-01T00:00:00Z",
                "resources": {
                    "codex_memory": {"backup": str(codex_backup), "target": str(codex_target)},
                    "ledger_logs": {"backup": str(ledger_backup), "target": str(ledger_target)},
                    "companion_settings": {"backup": str(companion_backup), "target": str(companion_target)},
                },
            }
        ),
        encoding="utf-8",
    )

    env = dict(os.environ)
    env["VAULTFIRE_RECOVERY_SNAPSHOT"] = str(snapshot)

    result = _run_cli("--recover", env=env)
    assert result.returncode == 0, result.stderr
    payload = _extract_json(result.stdout)
    assert payload["mode"] == "recovery"
    assert payload["resources"]["codex_memory"]["status"] == "restored"
    assert codex_target.read_text(encoding="utf-8") == "codex-backup"
    assert ledger_target.read_text(encoding="utf-8") == "ledger-backup"
    assert companion_target.read_text(encoding="utf-8") == "companion-backup"
