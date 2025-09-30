#!/usr/bin/env bash
set -euo pipefail

# Vaultfire deployment helper. Intended for staging/production parity releases.
# Usage: ./ops/deploy-prod.sh staging|production

ENVIRONMENT="${1:-staging}"
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "[deploy] Unknown environment: $ENVIRONMENT" >&2
  echo "Usage: $0 staging|production" >&2
  exit 1
fi

APP_NAME="vaultfire-partner-sync"
IMAGE_TAG="${ENVIRONMENT}-$(date +%Y%m%d%H%M%S)"
REGISTRY_URL="${REGISTRY_URL:-registry.vaultfire.local}"
DOCKER_CONTEXT="${DOCKER_CONTEXT:-.}"

echo "[deploy] Building container for $APP_NAME ($ENVIRONMENT)"
docker build "$DOCKER_CONTEXT" \
  --platform linux/amd64 \
  --tag "$REGISTRY_URL/$APP_NAME:$IMAGE_TAG"

echo "[deploy] Pushing image to $REGISTRY_URL"
docker push "$REGISTRY_URL/$APP_NAME:$IMAGE_TAG"

REMOTE_HOST="${VAULTFIRE_DEPLOY_HOST:-deploy.vaultfire.local}"
REMOTE_USER="${VAULTFIRE_DEPLOY_USER:-vaultfire}"
SSH_TARGET="$REMOTE_USER@$REMOTE_HOST"

echo "[deploy] Updating stack on $SSH_TARGET"
ssh "$SSH_TARGET" <<EOSSH
  set -euo pipefail
  docker pull $REGISTRY_URL/$APP_NAME:$IMAGE_TAG
  docker stop $APP_NAME || true
  docker rm $APP_NAME || true
  docker run -d \
    --restart unless-stopped \
    --name $APP_NAME \
    -e NODE_ENV=$ENVIRONMENT \
    -e VAULTFIRE_ACCESS_SECRET="\${VAULTFIRE_ACCESS_SECRET}" \
    -e VAULTFIRE_RESPONSE_SIGNING_SECRET="\${VAULTFIRE_RESPONSE_SIGNING_SECRET}" \
    -p 4050:4050 \
    $REGISTRY_URL/$APP_NAME:$IMAGE_TAG
EOSSH

echo "[deploy] Deployment complete: $APP_NAME@$ENVIRONMENT"
