#!/usr/bin/env bash
# Vaultfire – Worldcoin Identity Bridge
# Nothing here constitutes legal, medical, or financial advice.
# Partners must perform their own compliance review before using this script.
# This script syncs a Worldcoin ID with the OpenRouter dev environment.

set -e

CONFIG_PATH="vaultfire_openrouter.json"

if [ ! -f "$CONFIG_PATH" ]; then
  echo "Config file not found: $CONFIG_PATH" >&2
  exit 1
fi

WORLD_ID=$(jq -r '.world_id' "$CONFIG_PATH")
OR_KEY=$(jq -r '.openrouter_key' "$CONFIG_PATH")

if [ -z "$WORLD_ID" ] || [ -z "$OR_KEY" ]; then
  echo "Required config values missing" >&2
  exit 1
fi

curl -X POST https://openrouter.ai/api/v1/identity-sync \
  -H "Authorization: Bearer $OR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"world_id": "'"${WORLD_ID}"'"}'
