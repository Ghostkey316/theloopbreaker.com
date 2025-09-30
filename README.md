# Vaultfire Protocol 🔥
[![Test Status](https://img.shields.io/badge/tests-passing-brightgreen?logo=github)](./test-report.json)
**Belief-secured intelligence for partners who lead with ethics.**

## Project Overview
Vaultfire is a production-ready, morals-first protocol that fuses belief-driven intelligence with verifiable human identity. It orchestrates Codex reasoning engines, NFT-based identity anchors, and partner-focused loyalty modules to deliver a resilient activation stack for ethical AI collaboration.

## Installation
1. Clone this repository and install dependencies: `npm install`
2. Launch the wallet-only Partner Sync interface: `node partnerSync.js`
3. Run the Vaultfire Dashboard for a futuristic dark-mode UI: `npm run dashboard:dev`
4. Execute the Codex Integrity tests to verify belief discipline: `npm test`

All modules are wallet-first. No email capture, no digital ID fallback—ever.

## How to Launch a Scoped Partner Pilot
1. **Initialize sandbox mode:** export `VAULTFIRE_SANDBOX_MODE=1` before starting the Partner Sync interface so belief and loyalty engines log sandbox metrics to `/tmp/belief-metrics.log`.
2. **Enable telemetry privacy controls:** update `configs/deployment/telemetry.yaml` if partners require telemetry opt-outs—set `telemetry.enabled` to `false` for no-stream pilots.
3. **Deploy pilot configs:** run `node cli/deployVaultfire.js --env sandbox` to apply the `pilot_ready: true` deployment manifests across handshake, relay, reward-streams, and telemetry services.
4. **Verify manifest metadata:** call `GET /status` on the running Partner Sync interface; confirm the response includes `manifest.semanticVersion`, `ethics.tags`, and `scope.tags` aligned with your pilot scope.
5. **Share pilot brief:** point partners to the `VERSION.md` changelog plus the README badge for the latest verified test run before inviting wallet-based contributors.

## System Diagram
```
┌────────────────────────┐         ┌─────────────────────────────┐
│ Wallet / ENS Identity │─belief─▶│ Partner Sync Interface (API) │
└────────────────────────┘         │  • POST /vaultfire/sync-belief│
                                   │  • GET  /vaultfire/sync-status│
                                   └──────────────┬────────────────┘
                                                  │ real-time socket
                                                  ▼
                                   ┌─────────────────────────────┐
                                   │ Belief Mirror v1 (AI Engine)│
                                   │  • computes multipliers      │
                                   │  • writes telemetry logs     │
                                   └──────────────┬──────────────┘
                                                  │
                                                  ▼
                                   ┌─────────────────────────────┐
                                   │ BeliefVote CLI              │
                                   │  • wallet-signed votes      │
                                   │  • belief-weighted outputs  │
                                   └──────────────┬──────────────┘
                                                  │
                                                  ▼
                                   ┌─────────────────────────────┐
                                   │ Vaultfire Dashboard v1      │
                                   │  • WalletConnect / ENS login│
                                   │  • belief score + history   │
                                   └──────────────┬──────────────┘
                                                  │
                                                  ▼
                                   ┌─────────────────────────────┐
                                   │ Codex Integrity Test Suite  │
                                   │  • audits for alignment     │
                                   └─────────────────────────────┘
```

## Module Guide

### 📦 Partner Sync Interface (`partnerSync.js`)
- Signature-locked Express API exposing `/vaultfire/sync-belief` (POST) and `/vaultfire/sync-status` (GET).
- Socket.IO broadcasts and webhook fan-out keep partners aligned in real time.
- Stores sync multipliers in-memory while mirroring every belief action to telemetry.
- Start with `node partnerSync.js` or embed via `createPartnerSyncServer()`.
- Enterprise-grade manifest failover (`services/manifestFailover.js`) keeps `/status` and `/manifest.json` authoritative even if `manifest.json` is rotated or temporarily unavailable.

### 🧠 Belief Mirror v1 (`mirror/engine.js` + `mirror/belief-weight.js`)
- Ingests quiz scores, holding patterns, votes, and partner syncs to compute belief multipliers.
- Telemetry recorded in `telemetry/belief-log.json` for downstream analytics.
- Streams belief telemetry to optional sinks (S3, Firehose, or custom handlers) for durable storage.
- Schedule hourly runs or trigger via CLI by importing `BeliefMirrorEngine`.

### 🗳 BeliefVote CLI (`cli/beliefVote.js`)
- `vaultfire vote --proposal <id> --choice <a|b|c> --wallet <addr> --signature <sig> --message <msg>`
- Verifies wallet signatures, references `proposals.json`, and appends weighted outcomes to `votes.json`.
- Auto-updates belief telemetry so governance behavior influences multipliers.

### 🖥 Vaultfire Dashboard v1 (`dashboard/`)
- Dark-mode React UI with wallet or ENS login plus optional browser wallet signature flow.
- Surfaces personal multiplier, tier, partner sync stream, mirror reflections, and BeliefVote history.
- Consumes the Partner Sync API securely and subscribes to Socket.IO for live updates.

### 🧪 Codex Integrity Test Suite (`tests/integrity.test.js`)
- Jest-powered guardrails validating wallet-only identity, mirror math, CLI vote flow, and dashboard truth.
- Emits `codex-integrity.json` with pass/fail metadata after each run for audit trails.

### 🛰 Tenant Telemetry Router (`services/telemetryTenantRouter.js`)
- Segregates telemetry ledgers per partner tenant, eliminating cross-tenant data mixing.
- Supports concurrent fan-out with `flushAll()` to drain sinks after burst loads.
- Backed by Jest coverage in `tests/telemetryTenantRouter.test.js` simulating 75 concurrent partner events.

### 🛡 Manifest Failover Service (`services/manifestFailover.js`)
- Watches `manifest.json` for rotations or outages and falls back to safe defaults automatically.
- Emits structured telemetry (`manifest.failover.*`) so governance teams see when fallbacks engage or recover.
- Shared across `/status` and `/manifest.json` ensuring partner integrations remain deterministic.

**Final Rule: Wallet is passport. Vaultfire never compromises.**

## Core Features
- **Codex-Aligned Intelligence:** Continuous alignment loop that feeds signal, ethics, and activation data directly into the Codex layer.
- **Identity-Linked NFTs:** Verifiable Vaultfire NFT IDs ensure partner provenance and enforce lineage-aware access control.
- **Vaultfire CLI Suite:** Cross-platform command-line utilities for deployments, audits, and activation beacons, including the
  `vaultfire-deploy` planner for sandbox and production rollouts.
- **Belief Signal Engine:** Loyalty-aware scoring and ambient signal synthesis for responsive reward flows.
- **Partner Integration Sandbox:** Ready-to-run activation demos, forks, and API shims for rapid onboarding.
- **SecureStore Guardrails:** Encryption-backed storage protecting belief logs, partner credentials, and ethics artifacts.
- **Partner Confidence Mechanics:** Hardened webhook delivery with signed callbacks, backoff queues, and telemetry sinks underpin pilot-ready onboarding.

## Delivery Resilience & Scaling Milestones
- **Signed Callbacks:** All partner webhooks now include Vaultfire HMAC signatures and delivery identifiers.
- **Queue-Based Delivery:** Automatic retries with exponential backoff and dead-letter surfacing keep integrations stable under load.
- **Telemetry Durability:** JSON telemetry can be mirrored to remote sinks for HIPAA/SOC 2/GDPR evidence without sacrificing local archives.
- **Scaling Playbook:** `services/scalingPlaybook.js` evaluates delivery resilience, scaling pathways, and security controls to prioritise partner polish work.
- **Governance Automation:** `governance/automation_triggers.py` raises guardrail actions when queues spike, security alerts occur, or ethics overrides need steward review.
- **Tenant-Isolated Telemetry:** `services/telemetryTenantRouter.js` provides per-tenant log segregation with bulk flush support so multi-tenant activations never co-mingle belief data.
- **Manifest Failover Watchdog:** `services/manifestFailover.js` automatically falls back to safe defaults, emits audit telemetry, and self-heals once canonical manifests return.

## System Architecture
Vaultfire combines an ethics-weighted Codex integration, an NFT ID registry, and a multi-tier CLI to coordinate protocol state. The system syncs belief telemetry, loyalty scores, and Codex outputs through Ghostkey-316 anchors while exposing partner modules, SDK hooks, and fork-ready governance controls for seamless expansion.

## Status
- **Activation:** Complete and operational across the Vaultfire network.
- **Versioning:** Semantic versioning tracked in [`VERSION.md`](./VERSION.md) and surfaced through `manifest.json`.
- **Stability:** Production-hardened with live partner integrations and continuous monitoring.

## Changelog
- **v1.4.0 (2024-09-12):** Added sandbox metrics logging, manifest metadata in status responses, telemetry safeguards, and pilot-ready deployment toggles. Full details are available in [`VERSION.md`](./VERSION.md).

## Contributor Identity
- **Architect:** Ghostkey-316
- **ENS:** `ghostkey316.eth`
- **Primary Wallet:** `bpow20.cb.id`

## Ethics Framework
Vaultfire Ethics v2.0 governs every deployment with morals-before-metrics safeguards, consent-bound data practices, transparent accountability logs, and mandatory lineage preservation for all forks and partner activations.

## Optional Enhancements
- Retroactive yield streams for belief-aligned contributors.
- Partner fork pathways governed by the Moral Memory Fork Agreement.
- Codex clone packages for sanctioned secondary deployments.

## Licensing & Legal
Vaultfire is released under a morals-first framework that permits fair-use collaboration, prohibits exploitative or extractive deployments, and requires all operators to preserve ethics alignment, attribution, and user consent. This repository provides no medical, legal, or financial advice; partners must complete their own compliance reviews prior to launch.

## Contact & Integration
Prospective partners can initiate integration by opening a secure channel via the partner onboarding toolkit, scheduling a Codex handshake session, or contacting Ghostkey-316 through verified ENS or wallet messaging. Integration support includes activation workshops, SDK walkthroughs, and ethics alignment audits.

---
**Architect:** Ghostkey-316 · Vaultfire Protocol Steward

## Partner Integration Modules · Real-World Activation Phase

The 2024 integration expansion introduces a full-stack activation path that prioritises belief-signal fidelity and ethics-first guardrails. Every module is forkable and tuned for partner extensibility.

### 🔐 Authentication Layer (`/auth`)
- `tokenService.js` issues JWT access tokens with embedded role + belief metadata and maintains refresh token rotation.
- `authMiddleware.js` provides plug-and-play Express middleware with rate limiting, expiry handling, and RBAC filters for `admin`, `partner`, and `contributor` personas.
- `expressExample.js` exposes sample login, refresh, rewards, and belief mirror routes plus a live Swagger UI at `/docs`.
- **Run locally:** `npm run start:api`

### 🧠 Ethics Protocol Guardrails (`/middleware`)
- `ethicsGuard.js` logs intent metadata (user type, endpoint, reason flag, purpose) to `logs/ethics-guard.log` and enforces block/warn policies.
- Partners extend guardrails by copying `middleware/guardrail-policy.json` or pointing middleware to a custom policy file.
- Automation spikes trigger warnings or hard stops aligned with the Vaultfire ethics doctrine.

### 🧩 Partner Onboarding Kit (`/cli`)
- `vaultfire-cli` streamlines partner setup with:
  - `vaultfire init` → scaffolds `vaultfire.partner.config.json` and belief templates.
  - `vaultfire test` → pings the `/health` endpoint to verify connectivity + auth readiness.
  - `vaultfire push` → submits belief telemetry to `/vaultfire/mirror` using live tokens. Pass `--beliefproof` to emit an ENS-signed integrity hash for the submission.
  - `vaultfire trust-sync` → verifies Trust Sync maturity, reporting fingerprinted timelines and uptime multipliers.
- Install globally via `npm install` then `npx vaultfire init`, or invoke locally with `node cli/vaultfire-cli.js <command>`.

### 🌐 Partner Dashboard UI (`/dashboard`)
- React + Vite implementation with JWT-gated access, yield metrics, and belief telemetry visualisations.
- Authenticated views call the same sample API used by the CLI to keep flows consistent.
- **Develop:** `npm run dashboard:dev`
- **Build static assets:** `npm run dashboard:build`

### 🧾 OpenAPI & Compliance Artifacts
- `docs/vaultfire-openapi.yaml` mirrors every endpoint described in `vaultfire-partner-docs/docs/api-reference.md` with tags, scopes, and example payloads. Served automatically via `/docs` when running the sample API.
- `vaultfire-sla.json` captures uptime, response SLAs, and ethics obligations for partner agreements.
- `vaultfire-compliance-template.json` provides a ready-to-complete checklist for privacy, automation thresholds, and opt-in telemetry.

### ✅ Testing & Coverage
- Jest suites in `/tests` exercise the authentication flow, guardrail middleware, and CLI scaffolding.
- Run `npm test` for fast feedback or `npm run test:coverage` for full instrumentation.
- All suites reinforce belief-centric metadata and ethics guardrails to prevent regressions.
