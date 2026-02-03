<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Vaultfire Repo Audit (Professional Pass)

Date: 2026-02-01
Scope: `ghostkey-316-vaultfire-init` (code + docs + CI guardrails + repo hygiene)

## Executive summary
- ✅ Core test suite passes locally (Jest + Hardhat).
- ✅ Guardrails and all “autogen surface” checks pass locally.
- ✅ CI is green after cross-platform normalization (line endings + path separators).
- ⚠️ `npm run preflight` is currently **broken** due to a missing dependency (`wrap-ansi`).
- ⚠️ `npm audit` reports multiple transitive vulnerabilities (most **no-fix-available**, typical Hardhat ecosystem issues).
- ℹ️ Several files are **byte-identical duplicates**; most appear intentional placeholders/fixtures (`.gitkeep`, empty lock files, sample logs), but we should confirm whether these are meant to ship.

## 1) Build/test correctness
### Jest
- Command: `npm test`
- Result: **PASS** (104 suites / 304 tests)
- Note: Jest reports **1 open handle** (`PIPEWRAP`) tied to `process.stdin.isTTY` usage in `Vaultfire/cli/fhe_setup_wizard.js:120` and `__tests__/fhe_setup_wizard.test.js:40`. Exit code is still 0.
  - Impact: can cause flaky CI on some runners, and makes it harder to trust `--detectOpenHandles`.
  - Recommended fix: in the test, mock `process.stdin.isTTY` / restore it, or refactor `parseWizardArgs` to accept `stdinIsTTY` as an injectable param.

### Hardhat
- Command: `npx hardhat test`
- Result: **PASS** (346 passing)

## 2) Guardrails + enforced surfaces (Vaultfire safety rails)
All passed locally:
- `npm run lint:guardrails`
- `npm run lint:values`
- `npm run lint:privileged-surface`
- `npm run lint:events-surface`
- `npm run lint:external-calls`
- `npm run lint:storage-growth`

## 3) Preflight (developer experience)
- Command: `npm run preflight`
- Result: **FAIL**
- Error: `Cannot find module 'wrap-ansi'` required by `tools/preflight-check.js`

**Why this matters:** preflight is the “first impression” command. If it fails for a new contributor, it harms adoption.

**Fix options:**
1) Add missing dependency to `devDependencies`: `wrap-ansi` (and pin a compatible version).
2) Remove `wrap-ansi` usage and do simple formatting without it.

## 4) Dependency / supply chain audit
- Command: `npm audit --audit-level=high`
- Result: **38 vulnerabilities** (23 low, 15 moderate)

Key notes:
- Many findings are transitive via `hardhat` toolchain (`cookie`, `undici`, `tmp`, `elliptic`, etc.) and show **“No fix available”**.
- One item (`diff`) has a fix available via `npm audit fix`.
- One item (`esbuild` via `vite`) has a fix available only via `npm audit fix --force` (breaking).

**Recommendation:**
- Do **not** force-upgrade blindly.
- Track these in a dedicated doc and/or GitHub issue, and periodically reassess when upstream publishes fixes.
- Consider isolating dev-only tooling so production artifacts are not affected.

## 5) Duplicate files / repo hygiene
I generated a duplicate-content report (SHA256-based) at:
- `docs/AUDIT_DUPLICATE_FILES.txt`

Highlights:
- Many duplicates are expected (empty `.gitkeep`, empty `__init__.py`, placeholder `*.json.lock`).
- There are also multiple identical JSON/log files (e.g., `earners.json`, `votes.json`, `event_log.json`, etc.). These *might* be intentional templates, but if they are just placeholders, we should consolidate or move them under a clear `fixtures/` or `examples/` directory.

## 6) What I didn’t do (and can do next)
- Deep Solidity audit beyond existing CI (Slither run in GitHub Actions): I can do a targeted manual review of privileged functions, external call sites, access controls, and economic invariants — but it takes a bit more time.
- Automated link checking across docs (dead links): can add a lightweight link-check script to CI.

## Recommended next actions (ordered)
1) **Fix `npm run preflight`** (missing `wrap-ansi`).
2) Fix Jest open-handle warning for the FHE setup wizard test.
3) Decide policy for placeholder/duplicate JSON/log files (keep as fixtures vs consolidate).
4) Add a doc: `docs/security/SUPPLY_CHAIN_NOTES.md` capturing `npm audit` findings + rationale.
5) Optional: add CI step for markdown link validation.
