# Safe Defaults (Privacy-Preserving) — @vaultfire/sdk

This repository includes a **minimal, real** safe-default wrapper around the core SDK.

The goal is adoption without foot-guns:
- **Do not transmit raw user statements/PII** by default
- **Disable analytics** by default
- **Reduce accidental data leakage** by removing `metadata` from the common path

> The underlying on-chain primitive is a `beliefHash` (`bytes32`). This wrapper hashes locally so you never need to send a raw statement anywhere.

## Use the safe wrapper

```ts
import { VaultfireSafeSDK, ModuleType } from '@vaultfire/sdk';
import { Wallet } from 'ethers';

const vaultfire = new VaultfireSafeSDK({
  chain: 'base-sepolia',
  // Recommended: stable per-app secret salt via env var.
  privacySalt: process.env.VAULTFIRE_PRIVACY_SALT,
});

vaultfire.connect(new Wallet(process.env.PRIVATE_KEY!));

const result = await vaultfire.verifyStatement({
  statement: 'I contribute to open source',
  moduleId: ModuleType.GITHUB,
});

console.log(result.verified, result.txHash);
```

## What gets sent / stored

- **Sent on-chain:** `beliefHash` (keccak256 of the statement or salted statement), optional ZK proof bundle.
- **Not sent (by this wrapper):** raw statement text, `metadata`.

## Recommended privacy salt

If statements are short/common, unsalted hashes can be guessed by an attacker.

Provide a stable secret salt:

- `VAULTFIRE_PRIVACY_SALT="<random 32+ bytes>"`
- Hashing becomes: `keccak256(UTF8("${salt}:${normalizedStatement}"))`

This prevents rainbow-table attacks against common phrases.

## Logging guidance

- Do **not** log raw statements.
- Log only `beliefHash`, `txHash`, and module id.
- If you must correlate user actions, store an **app-internal identifier** separate from the statement.

## Escape hatch

If you truly need the full API surface, you can access it:

```ts
const raw = vaultfire.unsafeRaw();
```

This is intentionally named to discourage casual use.
