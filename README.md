# Vaultfire Protocol 🔥
**Belief-secured intelligence for partners who lead with ethics.**

## Project Overview
Vaultfire is a production-ready, morals-first protocol that fuses belief-driven intelligence with verifiable human identity. It orchestrates Codex reasoning engines, NFT-based identity anchors, and partner-focused loyalty modules to deliver a resilient activation stack for ethical AI collaboration.

## Installation
1. Clone this repository and install dependencies: `npm install`
2. Launch the wallet-only Partner Sync interface: `node partnerSync.js`
3. Run the Vaultfire Dashboard for a futuristic dark-mode UI: `npm run dashboard:dev`
4. Execute the Codex Integrity tests to verify belief discipline: `npm test`

All modules are wallet-first. No email capture, no digital ID fallback—ever.

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

### 🧠 Belief Mirror v1 (`mirror/engine.js` + `mirror/belief-weight.js`)
- Ingests quiz scores, holding patterns, votes, and partner syncs to compute belief multipliers.
- Telemetry recorded in `telemetry/belief-log.json` for downstream analytics.
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

**Final Rule: Wallet is passport. Vaultfire never compromises.**

## Core Features
- **Codex-Aligned Intelligence:** Continuous alignment loop that feeds signal, ethics, and activation data directly into the Codex layer.
- **Identity-Linked NFTs:** Verifiable Vaultfire NFT IDs ensure partner provenance and enforce lineage-aware access control.
- **Vaultfire CLI Suite:** Cross-platform command-line utilities for deployments, audits, and activation beacons.
- **Belief Signal Engine:** Loyalty-aware scoring and ambient signal synthesis for responsive reward flows.
- **Partner Integration Sandbox:** Ready-to-run activation demos, forks, and API shims for rapid onboarding.
- **SecureStore Guardrails:** Encryption-backed storage protecting belief logs, partner credentials, and ethics artifacts.

## System Architecture
Vaultfire combines an ethics-weighted Codex integration, an NFT ID registry, and a multi-tier CLI to coordinate protocol state. The system syncs belief telemetry, loyalty scores, and Codex outputs through Ghostkey-316 anchors while exposing partner modules, SDK hooks, and fork-ready governance controls for seamless expansion.

## Status
- **Activation:** Complete and operational across the Vaultfire network.
- **Versioning:** Vaultfire Protocol v1.x (semantic versioning via changelog.json).
- **Stability:** Production-hardened with live partner integrations and continuous monitoring.

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
- `ethicsGuard.js` logs intent metadata (user type, endpoint, reason flag) to `logs/ethics-guard.log` and enforces block/warn policies.
- Partners extend guardrails by copying `middleware/guardrail-policy.json` or pointing middleware to a custom policy file.
- Automation spikes trigger warnings or hard stops aligned with the Vaultfire ethics doctrine.

### 🧩 Partner Onboarding Kit (`/cli`)
- `vaultfire-cli` streamlines partner setup with:
  - `vaultfire init` → scaffolds `vaultfire.partner.config.json` and belief templates.
  - `vaultfire test` → pings the `/health` endpoint to verify connectivity + auth readiness.
  - `vaultfire push` → submits belief telemetry to `/vaultfire/mirror` using live tokens.
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
