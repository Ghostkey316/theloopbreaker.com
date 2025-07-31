#!/bin/bash
# Vaultfire partner validation script
# Ensures partner config exists and sets validation flag
# No personal data is stored beyond this check.

set -e

if [[ "$1" != "--partner" ]]; then
  echo "Usage: $0 --partner" >&2
  exit 1
fi

echo "Validating Ghostkey-316 partner clone..."
if [ -f "vaultfire_openrouter.json" ]; then
  echo "✅ Identity config found."
  if [ -f .env ]; then
    if grep -q '^PARTNER_VALID=' .env; then
      sed -i 's/^PARTNER_VALID=.*/PARTNER_VALID=1/' .env
    else
      echo 'PARTNER_VALID=1' >> .env
    fi
  else
    echo 'PARTNER_VALID=1' > .env
  fi
  exit 0
else
  echo "❌ Missing vaultfire_openrouter.json"
  exit 1
fi
