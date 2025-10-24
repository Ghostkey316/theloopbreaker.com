# Vaultfire Privacy Launch Playbook

## Sandbox Pilot Activation

1. Prepare the sandbox profile (`sandbox_profile.yaml`) with partner metadata.
2. Run the sandbox initialiser:
   ```bash
   ./bin/codex pilot:init --profile sandbox_profile.yaml
   ```
   The command provisions a deterministic testnet mirror, redirects telemetry to `sandbox/vaultfire_trace.json`, and seeds the sandbox x402 proxy shield.
3. Inspect the generated launch summary at `vaultfire/partners/pilot_drop/sandbox_launch_summary.json` before sharing with the partner team.

## Onboarding Variants

The `onboarding/path_config.yaml` file defines three streamlined routes with fewer than five steps each:

- **wallet-only** – hardware wallet readiness without codex extensions.
- **codex-only** – deterministic codex sandbox with telemetry redirect.
- **full-sovereign** – wallet, codex, and attestation wiring for sovereign deployments.

Execute the bootstrap helper to auto-detect the host OS, install prerequisites, and trigger the one-click verifier:

```bash
./onboarding/vaultfire_bootstrap.sh --path codex-only --partner ghostkey-alpha
```

The helper calls `vaultfire_onboard`, which can be invoked directly for custom paths:

```bash
./vaultfire_onboard --path codex-only --partner ghostkey-alpha --dry-run
```

## Audit Pack Generation

Use the CLI attestation command to assemble the cryptographic package:

```bash
python -m vaultfire_cli attest --output pack --sign ghostkey316
```

This produces `vaultfire_attestation_pack.json`, embedding hashes for `vaultfire/trust/fhe_proof.json`, `vaultfire/trust/zk_codex_receipts.json`, and the `codex_checker.py` validation report. Share the resulting file (and optional `.sig` attachment) with partner compliance teams via `vaultfire/partners/pilot_drop/`.
