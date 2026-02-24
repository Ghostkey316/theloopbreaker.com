#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  Vaultfire / Embris Protocol — Pre-Commit Secret Scanner
# ═══════════════════════════════════════════════════════════════════════════════
#
#  Delegates to scripts/embris_scan.py — the single source of truth for
#  secret detection logic. Both this hook and the GitHub Actions workflow
#  use the same scanner, so local and CI behaviour are always identical.
#
#  INSTALLATION AS GIT PRE-COMMIT HOOK:
#  ─────────────────────────────────────
#  Option A — Symlink (recommended, stays in sync automatically):
#    ln -sf ../../scripts/check-secrets.sh .git/hooks/pre-commit
#    chmod +x .git/hooks/pre-commit
#
#  Option B — Copy:
#    cp scripts/check-secrets.sh .git/hooks/pre-commit
#    chmod +x .git/hooks/pre-commit
#
#  MANUAL USAGE:
#    bash scripts/check-secrets.sh          # scans staged files only
#    bash scripts/check-secrets.sh --all    # scans entire repo
#
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# Locate repo root (works whether called as a hook or directly)
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCANNER="${REPO_ROOT}/scripts/embris_scan.py"

if [ ! -f "$SCANNER" ]; then
  echo "ERROR: Cannot find scanner at ${SCANNER}"
  echo "       Make sure scripts/embris_scan.py exists in the repository."
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 is required but not found in PATH."
  echo "       Install Python 3.8+ to use the Embris Protocol secret scanner."
  exit 1
fi

# ── Staged-files mode (default, used as pre-commit hook) ────────────────────
if [ "${1:-}" != "--all" ]; then
  # Get list of staged files (added or modified, not deleted)
  STAGED=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

  if [ -z "$STAGED" ]; then
    exit 0
  fi

  # Pass staged files to the scanner
  # shellcheck disable=SC2086
  python3 "$SCANNER" --root "$REPO_ROOT" --files $STAGED
else
  # Full repo scan
  python3 "$SCANNER" --root "$REPO_ROOT"
fi
