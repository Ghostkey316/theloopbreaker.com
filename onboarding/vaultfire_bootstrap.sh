#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
PATH_CHOICE="codex-only"
PARTNER="ghostkey-alpha"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      PATH_CHOICE="$2"
      shift 2
      ;;
    --partner)
      PARTNER="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift 1
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

OS_NAME=$(uname -s)
case "$OS_NAME" in
  Darwin)
    INSTALL_HINT="brew bundle --file=${REPO_ROOT}/requirements.osx"
    ;;
  Linux)
    INSTALL_HINT="python3 -m pip install -r requirements.txt"
    ;;
  *)
    INSTALL_HINT="python3 -m pip install -r requirements.txt"
    ;;
esac

echo "[vaultfire_bootstrap] Detected operating system: ${OS_NAME}"
echo "[vaultfire_bootstrap] Recommended install step: ${INSTALL_HINT}"
echo "[vaultfire_bootstrap] Using onboarding path: ${PATH_CHOICE}"
echo "[vaultfire_bootstrap] Partner identifier: ${PARTNER}"

ONBOARD_CMD="${REPO_ROOT}/vaultfire_onboard --path ${PATH_CHOICE} --partner ${PARTNER}"
if [[ "${DRY_RUN}" == true ]]; then
  ONBOARD_CMD+=" --dry-run"
fi

echo "[vaultfire_bootstrap] Running readiness check via: ${ONBOARD_CMD}"
exec ${ONBOARD_CMD}
