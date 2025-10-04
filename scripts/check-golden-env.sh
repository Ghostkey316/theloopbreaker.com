#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="configs/golden-environment.json"

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "[golden-env] Missing configuration at $CONFIG_PATH" >&2
  exit 1
fi

python3 <<'PY'
import json
import subprocess
import sys
from pathlib import Path

config_path = Path("configs/golden-environment.json")
with config_path.open("r", encoding="utf-8") as handle:
    config = json.load(handle)

def read_version(command: str) -> str:
    try:
        output = subprocess.check_output(command, shell=True, text=True)
    except subprocess.CalledProcessError as exc:
        print(f"[golden-env] ERROR: Failed to execute '{command}': {exc}", file=sys.stderr)
        sys.exit(1)
    return output.strip().lstrip('v')


def version_tuple(version: str):
    parts = []
    for piece in version.split('.'):
        if not piece:
            continue
        digits = ''.join(ch for ch in piece if ch.isdigit())
        if digits:
            parts.append(int(digits))
    return tuple(parts)


def assert_gte(name: str, command: str, expected: str):
    if not expected:
        print(f"[golden-env] WARN: No expected version configured for {name}; skipping.")
        return
    actual = read_version(command)
    actual_tuple = version_tuple(actual)
    expected_tuple = version_tuple(expected)
    if not actual_tuple:
        print(f"[golden-env] ERROR: Unable to parse {name} version '{actual}'.", file=sys.stderr)
        sys.exit(1)
    if actual_tuple < expected_tuple:
        print(
            f"[golden-env] FAIL: {name} {actual} is behind golden baseline {expected}.",
            file=sys.stderr,
        )
        sys.exit(1)
    print(f"[golden-env] OK: {name} {actual} meets or exceeds baseline {expected}.")

assert_gte("Node", "node -p 'process.version'", config.get("node", ""))
assert_gte("Python", "python3 -c 'import platform; print(platform.python_version())'", config.get("python", ""))
assert_gte("Vaultfire CLI", "node cli/vaultfire-cli.js --version", config.get("cli", ""))

print("[golden-env] Golden environment check complete.")
PY
