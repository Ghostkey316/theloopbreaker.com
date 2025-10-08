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
