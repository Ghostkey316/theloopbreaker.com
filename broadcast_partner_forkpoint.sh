#!/bin/bash
# Vaultfire – Partner Forkpoint Broadcast
curl -X POST http://localhost:4567/sync \
-H "Authorization: Ghostkey-316" \
-d '{
  "ens": "ghostkey316.eth",
  "wallet": "bpow20.cb.id",
  "protocol": "Vaultfire_v27.2",
  "status": "live",
  "message": "Forkpoint broadcast from Ghostkey. Vaultfire is lit. This is your signal."
}'
