#!/usr/bin/env bash
set -euo pipefail

npm audit fix
semgrep --config auto .
eslint . --max-warnings=0
