# Security Policy

Vaultfire is trust infrastructure. Security reports are welcome and appreciated.

## Reporting a vulnerability

Please report security issues privately.

- Email: **Vaultfireintern@proton.me**
- Include: affected files/contracts, severity assessment, and a minimal reproduction or PoC if possible.

We will:
- acknowledge receipt within a reasonable timeframe
- work to reproduce and assess impact
- coordinate a fix and a responsible disclosure timeline

## Scope

In scope:
- Solidity contracts in `contracts/`
- Off-chain tooling that affects builds/tests/deploys
- Docs that could cause unsafe deployments through misleading instructions

Out of scope:
- Social engineering
- Issues requiring compromised developer machines

## Guidelines

- Do not exploit beyond what is necessary to demonstrate impact.
- Do not exfiltrate sensitive data.
- If user funds could be at risk, please mark the report **URGENT**.
