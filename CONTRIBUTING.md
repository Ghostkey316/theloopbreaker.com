# Contributing to Vaultfire

Vaultfire is built to be verifiable, privacy-first, and mission-locked (Morals over Metrics • Privacy over Surveillance • Freedom over Control).

## Quick start

```bash
git clone https://github.com/Ghostkey316/ghostkey-316-vaultfire-init.git
cd ghostkey-316-vaultfire-init
npm install
npx hardhat test
```

## Development workflow

1) Create a branch
```bash
git checkout -b feat/my-change
```

2) Make changes

3) Run guardrails + tests
```bash
npm run lint:guardrails
npm run lint:values
npx hardhat test
```

4) Open a PR

## Standards

- Keep claims repo-grounded (code/tests/audit backed).
- Prefer small diffs.
- Avoid introducing surveillance/KYC requirements (guardrails enforce this).
- If you change economics/security invariants, add/adjust tests.

## Transparency & Preconditions (Vaultfire default)

Vaultfire is built to be **honest, inspectable, and audit-friendly**. That means code and tests should be explicit about what they need, what they guarantee, and what they *cannot* guarantee.

**Rules of thumb:**
- **Fail loudly on real risk or broken invariants.** Don’t swallow errors that could hide corruption, security regressions, or incorrect economics.
- **Skip loudly on missing prerequisites.** If a test depends on optional tooling (e.g., Python, external binaries), it must detect that and `skip()` with a clear reason.
- **Best-effort operations must be labeled.** If something is inherently platform-dependent (e.g., certain filesystem flush semantics on Windows), treat it as best-effort and document the behavior.
- **Make decisions observable.** When something is denied, degraded, or skipped, surface a human-readable reason in logs/test output.

If you add a new prerequisite, document it in the relevant README/docs and ensure CI behavior is deterministic (no silent passes).

## Security

Please do not open public issues for vulnerabilities. See `SECURITY.md`.
