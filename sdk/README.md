# Vaultfire SDK

The `vaultfire-sdk` package delivers a dual-language onboarding kit for the Empathic Resonance Verifier (ERV).
It wraps the low-level Vaultfire protocol APIs with ergonomic helpers for moral gradient attestations, oracle
emissions, and pilot simulations.

## Python usage

```python
from sdk import SymbioticForge  # or `from vaultfire_sdk import SymbioticForge` after installation

forge = SymbioticForge(wallet="ghostkey316.eth")
intent = {"alpha_power": 0.72, "theta_intent": "align", "proof": "demo-proof"}
tx_hash = forge.attest_moral_loop(intent)
pilot = forge.run_pilot_sim("loyalty")
```

Install locally with

```bash
pip install -e ./sdk
```

## JavaScript usage

```ts
import { SymbioticForge } from 'vaultfire-sdk';

const forge = new SymbioticForge('0x59c6995e998f97a5a0044966f094538b2928fbc9d8890f18d23e3f8cf2b5f1c1');
const txHash = await forge.attestMoralLoop({ alpha_power: 0.7, theta_intent: 'align' });
const sim = await forge.runPilotSim('loyalty');
```

Build and test with

```bash
npm install
tsc -p sdk/tsconfig.json
npx jest sdk/tests/symbioticForge.test.ts
```

Both SDKs default to sandbox-safe fallbacks while mirroring the live protocol surfaces.
