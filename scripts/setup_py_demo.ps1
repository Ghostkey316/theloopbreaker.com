<#
Vaultfire Python Demo Bootstrap

Goal: make Python demo paths (x402 listener + engine sims) work reliably.

This script:
  - creates a local venv (.venv-py)
  - installs minimal deps for the "full" demo server (Flask) + crypto layer

Usage:
  pwsh -File scripts/setup_py_demo.ps1
  .\.venv-py\Scripts\python.exe scripts\run_x402_listener.py

Notes:
  - This does NOT modify global Python packages.
  - If you only want no-deps mode, you can skip this and use the stdlib listener.
#>

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$VenvPath = Join-Path $RepoRoot '.venv-py'

$Python = $env:VAULTFIRE_PYTHON
if (-not $Python) {
  $Python = 'python'
}

Write-Host "[vaultfire] repo: $RepoRoot"
Write-Host "[vaultfire] venv: $VenvPath"
Write-Host "[vaultfire] python: $Python"

if (-not (Test-Path $VenvPath)) {
  & $Python -m venv $VenvPath
}

$VenvPython = Join-Path $VenvPath 'Scripts\python.exe'

# Upgrade pip tooling inside the venv
& $VenvPython -m pip install --upgrade pip setuptools wheel

# Minimal deps for the Python demo stack
# - flask: canonical x402 listener implementation
# - cryptography: enables ENC:: token encryption/decryption
& $VenvPython -m pip install flask cryptography

Write-Host "[vaultfire] ok: deps installed"
Write-Host "[vaultfire] run: $VenvPython scripts\run_x402_listener.py"
