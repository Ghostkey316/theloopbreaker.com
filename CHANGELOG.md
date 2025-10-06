# Vaultfire Partner Changelog

## 2025-10-28 — docs: quantum-aligned protocol expansion
- Elevated `FORKABLE_PROTOCOL.md` to version 1.2 with mission resonance rollups,
  confidential compute attestations, and FHE-streamed analytics channels while
  keeping the manifesto lock intact.
- Infused `vaultfire_3yr_protocol.yml` with sentinel mesh resilience, privacy-
  preserving analytics, and sustainability metrics so the roadmap scales with
  cutting-edge tech without compromising the core mission pillars.

## 2025-10-18 — docs: mission-locked protocol modernization
- Upgraded `FORKABLE_PROTOCOL.md` to version 1.1 with zk-SNARK attestation, post-quantum key rotation, and AI collaboration loops that preserve the Ghostkey manifesto mission lock.
- Expanded `vaultfire_3yr_protocol.yml` with innovation, security, and mission safeguard tracks that integrate edge inference meshes, zero-knowledge verification cadences, and alignment beacons.

## 2025-10-15 — feature: Aurora privacy core + partner autopilots
- Replaced the placeholder FHE stack with the Aurora runtime, delivering
  deterministic masking, auditable commitments, and hardened noise controls
  surfaced through the `vaultfire.security.fhe` module and new Aurora test
  coverage.
- Upgraded the biometric/ZK identity gate with live attestation ingestion and
  feed sync helpers so pilots can flip wallets from "pending" to "verified"
  without manual registry edits.
- Introduced MPC auto-blueprints that emit hashed partner manifests,
  enforce required fields, and expose compliance scopes straight from
  `MPCFabric.decrypt_summary()` to cut integration lift for enterprise rollouts.

## 2025-10-08 — fix: partner sign-off checklist completed
- Delivered optional email/OTP and social fallback identity flows that preserve on-chain authority while meeting partner preferences defined in `partner-auth-config.json`.
- Introduced ESLint-powered JSX/TS syntax verification with CI logging, Husky enforcement, and documentation in the developer guidelines.
- Captured fallback authentication coverage in Jest to validate wallet-off scenarios and isolated session storage.
- Finalised readiness docs to reflect the enforced syntax checks and cleared the remaining “before sign” considerations.

## 2025-10-08 — docs: complete PR trail in hardening log
- Logged the `/handshake` hardening PR lineage, commit hashes, and reviewer approvals for operational traceability.

## 2025-10-07 — fix: full remediation of protocol debt
- Added remote telemetry verification to the Trust Sync CLI with signature checks,
  remote digest comparisons, and warning surfacing for mismatches or fallbacks.
- Upgraded the signal relay with inline retry logic, durable scheduling, expanded
  telemetry, and new resilience documentation.
- Connected loyalty multipliers to the reward stream planner so contribution
  events trigger on-chain (or mock) stream updates with audit telemetry.
- Cleared legacy TODO placeholders across docs and services, aligning runbooks with
  the new retry, telemetry, and rewards integrations.

## 2025-09-30 — SECURITY: Fixed moderate transitive npm vulnerabilities
- Resolved GHSA-pxg6-pf52-xh8x by forcing all `cookie` consumers, including Hardhat's bundled `@sentry/node`, onto the patched `1.0.2` release via `npm overrides`.
- Eliminated GHSA-52f5-9888-hmc6 by pinning `tmp` to `0.2.5` for `solc` and any future consumers, removing the need for sandbox wrappers.
- Added a Husky pre-commit hook that blocks commits when `npm audit` reports vulnerabilities and scheduled a weekly CI audit watchdog that auto-files GitHub issues with advisory context.

## 2025-10-12 — Mobile Telemetry Hardening & Safety Controls
- Added mobile-aware residency, partner hook, and node telemetry updates that honour the `MOBILE_MODE` environment flag and hybrid runtime override.
- Introduced compact preflight output for `MOBILE_MODE=true npm run preflight` and expanded documentation covering dual test runs and optional Sentry fallbacks.
- Restored Jest stability when `@sentry/react` is absent by auto-mocking `withProfiler` and surfacing postinstall guidance.
- Sandboxed Hardhat/solc workflows via `infra/hardhat-sandbox.js` to mitigate the `cookie` and `tmp` advisories until upstream patches land.
- Expanded telemetry-focused Jest coverage to validate residency guard relaxations, partner hook skips, and Sentry fallbacks.

## 2025-10-02 — Residency Enforcement Sprint
- Introduced `telemetry/residencyGuard` with wildcard-aware host policies for telemetry DSNs and partner hooks.
- Updated `telemetry/nodeTelemetry` and partner hook adapters to block endpoints outside approved residency regions.
- Extended `npm run preflight` to fail fast when residency maps are missing or enforcement is disabled.
- Documented the residency policy workflow in `docs/telemetry-ledger.md` and shipped hardened defaults in `vaultfirerc.json`.

## 2025-10-04 — Mobile Readiness & Optional Telemetry
- Added `MOBILE_MODE` toggles, mobile-aware residency guards, and Trust Sync fallbacks to keep telemetry optional on phones and tablets.
- Updated `tools/preflight-check.js` with chalk + wrap-ansi formatting and automatic mobile skips for small-screen ergonomics.
- Created a mobile summary Jest suite and postinstall script to surface optional dependency messaging without breaking mobile pipelines.

## 2025-09-19 — v2.6.0-alpha Partner Readiness
- Added `signalRelay.retry()` with exponential backoff and a circuit-breaker guard to stabilise remote belief sync deliveries during partner outages.
- Hardened Trust Sync verification by enforcing timestamp windows, replay protection, and checksum fallbacks exposed via `trustSync.verify()`.
- Introduced the JavaScript loyalty engine with on-chain multiplier wiring, telemetry anchors, and the `calculateMultiplier()` interface for partner reward orchestration.
- Expanded Jest coverage with dedicated suites for the signal relay, Trust Sync verifier, and loyalty engine multiplier mapping.

## 2025-08-15 — v1.2.0-rc Partner Hardening
- Added `pilot-loader.js` with `VAULTFIRE_MODULE_SCOPE` controls so pilots boot only CLI, dashboard, and belief engines when `pilot_mode=true`.
- Introduced governance config loader supporting `.govrc`/`--config-path=` overrides, default-threshold warnings, and `npm run audit:gov` self-audits.
- Hardened telemetry fallbacks with JSON sink mirroring, partner hook adapters, and residency-aware docs for compliance teams.
- Refreshed partner documentation with a risk matrix, governance tuning playbook, and telemetry residency guidance.
- Expanded Vaultfire Core to support multi-wallet whitelists via `WALLET_WHITELIST` overrides while keeping single-wallet mode as the default.
- Added operational runbooks and onboarding coverage tooling so every module ships with setup, risk, and recovery guidance.
