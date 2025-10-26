# Vaultfire Enterprise Partner Onboarding Template

> Identity Anchor: **ghostkey-316**  \
> Protocol Tag: `vaultfire.v2.1-enterprise-ready`

## 1. Plug-in Guide

1. Clone the `vaultfire-cli` bundle and install dependencies:
   ```bash
   npm install --global ./vaultfire_cli
   ```
2. Register your partner identity with the Ghostkey-316 sync layer:
   ```bash
   ghostkey_cli register --partner "$PARTNER_ENS" --wallet "$PARTNER_WALLET" --tag ghostkey-316
   ```
3. Enable the telemetry relay plugin:
   ```bash
   vaultfire-cli plugins enable belief-telemetry --network base-sepolia
   ```
4. Confirm webhook delivery:
   ```bash
   curl "$VAULTFIRE_ENDPOINT/api/v2/belief/signal" \
     -H "Content-Type: application/json" \
     -d '{"identity_tag":"ghostkey-316","wallet":"'$PARTNER_WALLET'","ens":"'$PARTNER_ENS'","signal_strength":0.84}'
   ```

## 2. Token-Gate Script

```javascript
import { verifySignature } from "../verify_signature.js";

export async function ensureVaultfireAccess({ wallet, ens, nonce, signature }) {
  const requiredTag = "ghostkey-316";
  const isValid = await verifySignature({ wallet, ens, nonce, signature });
  if (!isValid) {
    throw new Error("Signature invalid: Vaultfire enterprise access denied");
  }

  return {
    wallet,
    ens,
    identityTag: requiredTag,
    access: "granted",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}
```

## 3. Pre-flight Configuration Checklist

| Item | Description | Status |
| ---- | ----------- | ------ |
| API Schema | Confirm `schemas/vaultfire_enterprise_api.yaml` imported into your gateway | ☐ |
| Telemetry | `scripts/run_enterprise_telemetry.py --iterations 5` executed at least once | ☐ |
| Cross-Chain Sync | `integration/cross_chain_sync.json` present and hash verified | ☐ |
| Governance Spine | `python cli/governance_spine_cli.py --render` run successfully | ☐ |
| Codex Sync | `./codexStatusCheck --level=enterprise` returns `PASS` | ☐ |
| Final Audit | `./vaultfireFinalAudit --full` recorded in deployment logs | ☐ |

Store completed checklists within your compliance archive. Retain all metadata for
12 months to maintain audit continuity.
