# Supply Chain Notes (npm audit)

This repo intentionally includes dev tooling for smart-contract development (Hardhat, Slither workflows, Vite dashboard tooling, etc.).
That ecosystem routinely carries **transitive npm audit findings**.

Vaultfire’s stance is:
- **We don’t ignore** these findings.
- We also **don’t blindly `--force` upgrade** toolchains in ways that could introduce breaking changes or subtle behavior drift.
- We document what’s present, why, and what mitigations exist.

## What `npm audit` means here
The `npm audit` output primarily concerns **developer tooling** (Hardhat + dependencies) rather than on-chain Solidity bytecode.
Still, supply-chain risk matters because:
- CI machines and developer workstations run this code.
- Toolchain compromise can poison builds, docs, or release artifacts.

## Current posture
- `npm audit --audit-level=high` currently reports moderate/low issues (often “no fix available”) in transitive dependencies.
- Many findings originate from:
  - Hardhat toolchain
  - Ethers v5 transitive deps
  - Vite/esbuild
  - misc utility libs (e.g. `tmp`, `undici`, `cookie`, `elliptic`)

## Mitigations already in place
- **Pinned lockfile** (`package-lock.json`) for deterministic installs.
- CI runs guardrails + tests so unintended drift is caught quickly.
- Security docs exist for:
  - Threat model (`docs/security/THREAT_MODEL.md`)
  - Privileged surface mapping
  - External call surface mapping
  - Monitoring alerts

## Recommended operating procedure
1. Treat **direct runtime dependencies** as higher priority than dev-only tooling.
2. Prefer **non-breaking upgrades** (`npm audit fix`) when they:
   - do not change major versions
   - do not change Hardhat / Vite majors
3. Avoid `npm audit fix --force` unless:
   - we’ve tested the full suite
   - we explicitly accept the breaking change and document it
4. When upstream says “no fix available”, we:
   - document the finding
   - track it periodically
   - evaluate compensating controls (sandboxed CI runners, least-privilege tokens)

## What contributors should do
- Run:
  - `npm test`
  - `npm run lint:guardrails`
  - `npm run preflight`
- If `npm audit` shows new high/critical issues in *direct* deps, open an issue.

## Future hardening ideas (optional)
- Add Dependabot/Renovate with rules (no major upgrades without human approval).
- Split packages into `devDependencies` only where possible.
- Run CI in more constrained permissions (least-privilege GitHub token + no secrets in PRs).
