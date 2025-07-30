#!/usr/bin/env bash
set -e
echo "[Vaultfire] Initializing secure setup..."
(
  python -m pip install --upgrade pip==23.2.1 setuptools==68.2.2 wheel==0.41.2
) && echo "[Vaultfire] Base Python tooling pinned" || echo "[Vaultfire] Warning: base tool install failed"

echo "[Vaultfire] Setup complete"
