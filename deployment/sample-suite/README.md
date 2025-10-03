# Vaultfire Sample Deployment Suite

This suite codifies two deployment presets that partners can fork when bridging from simulated pilots to live-ready rollouts.

- `mock-deployment.json` keeps the protocol in simulated mode with anonymised telemetry streams.
- `live-ready.json` activates the live indicator, hybrid compliance layer, and partner revenue bridges while still using obfuscated sample data.

Each manifest is compatible with `node cli/belief-mapper.js --map` for on-demand trust mapping and aligns with the `/deployment/status` endpoint.

## Usage

```bash
# Apply the simulated deployment
node cli/deployVaultfire.js --config deployment/sample-suite/mock-deployment.json

# Preview the live-ready configuration
node cli/deployVaultfire.js --config deployment/sample-suite/live-ready.json --dry-run
```

Both manifests set `vaultfire.partnerReady` explicitly so that external launches enable the interpreter module, trust map endpoint, and revenue bridge integrations by default.
