# Vaultfire Protocol

**Infrastructure for verifiable trust and identity between humans and AI**

> *The first belief-built protocol — where economic proof replaces blind faith.*

---

## TL;DR

Vaultfire is a protocol for **verifiable human<->AI trust** using cryptographic + economic proof (not behavioral surveillance).

This repo contains:
- protocol docs + reference implementations
- a preflight + test suite you can run locally
- optional **signed verification receipts** for coordination/auditing

Quick links:
- Quickstart: see **Requirements** + **Quickstart (bash)** below
- Partner Fast Verify: [`docs/PARTNER_FAST_VERIFY.md`](./docs/PARTNER_FAST_VERIFY.md)
- Verify receipts: [`docs/VERIFY_RECEIPTS.md`](./docs/VERIFY_RECEIPTS.md)
- Claims & limits: [`docs/CLAIMS_AND_LIMITS.md`](./docs/CLAIMS_AND_LIMITS.md)
- Security Model: [`SECURITY.md`](./SECURITY.md)

## Deployed Contracts

Vaultfire is deployed and verified on Base Mainnet (Primary) and Avalanche C-Chain.

### Base Mainnet (Chain ID: 8453)

| Contract | Address |
| :--- | :--- |
| **PrivacyGuarantees** | `0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e` |
| **MissionEnforcement** | `0x6EC0440e1601558024f285903F0F4577B109B609` |
| **AntiSurveillance** | `0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac` |
| **ERC8004IdentityRegistry** | `0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD` |
| **BeliefAttestationVerifier** | `0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a` |
| **ERC8004ReputationRegistry** | `0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C` |
| **ERC8004ValidationRegistry** | `0x50E4609991691D5104016c4a2F6D2875234d4B06` |
| **AIPartnershipBondsV2** | `0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855` |
| **AIAccountabilityBondsV2** | `0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140` |
| **VaultfireERC8004Adapter** | `0x02Cb2bFBeC479Cb1EA109E4C92744e08d5A5B361` |
| **MultisigGovernance** | `0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D` |
| **FlourishingMetricsOracle** | `0xb751abb1158908114662b254567b8135C460932C` |
| **ProductionBeliefAttestationVerifier** | `0xBDB5d85B3a84C773113779be89A166Ed515A7fE2` |
| **VaultfireTeleporterBridge** | `0xaD8D7aE60805B6e5d4BF6b70248AD8B46DEE9528` |

### Avalanche C-Chain (Chain ID: 43114)

| Contract | Address |
| :--- | :--- |
| **VaultfireTeleporterBridge** | `0x75de435Acc5dec0f612408f02Ae169528ce3a91b` |

## Requirements

Before running the Quickstart, make sure you have:
- **Node.js** (recommend **22.x**; 20+ should work)
- **npm** (ships with Node)
- **git**
- A **bash**-compatible shell (macOS/Linux terminal, or Windows **WSL**)
- Optional (for signed receipts): **OpenSSH** (`ssh-keygen`) and an SSH key (or set `VAULTFIRE_SIGNING_KEY`)

Windows note: if you are not using WSL, run the same commands in PowerShell (replace `export ...` with `$env:...=...`).

## Quickstart (bash)

**Fast verify (one command):**

Runs preflight + tests to verify Vaultfire installs cleanly and core invariants pass, then writes a tamper-evident verification receipt.

```bash
git clone https://github.com/ghostkey316/ghostkey-316-vaultfire-init.git && cd ghostkey-316-vaultfire-init && npm install && npm run verify
```

Expected output (high level):
- `npm run verify` exits successfully (exit code 0)
- preflight passes
- tests pass (Jest summary shows `... passed`)
- a receipt is written to `artifacts/verify-receipt.json`
- if an SSH signing key is available/configured, the receipt is signed to `artifacts/verify-receipt.sig` (and self-verified)

**Signed receipt (recommended):**

Set your signing key once, then run the strict signed verify:

```bash
export VAULTFIRE_SIGNING_KEY=~/.ssh/id_ed25519
npm run verify:signed
```

Expected output: same as `verify`, plus the signed receipt artifacts:
- `artifacts/verify-receipt.sig`
- `artifacts/verify-receipt.allowed_signers`

**Step-by-step:**

```bash
# Clone + install
git clone https://github.com/ghostkey316/ghostkey-316-vaultfire-init.git
cd ghostkey-316-vaultfire-init
npm install
# Expected output: completes without errors (exit code 0).

# Sanity checks
npm run preflight
# Expected output: completes without errors (exit code 0).

# Run tests
npm test
# Expected output: Jest reports all tests passing (exit code 0), e.g.
#   Test Suites: ... passed, ... total
#   Tests:       ... passed, ... total

# Write a tamper-evident verification receipt (no signing)
npm run verify:receipt
# Expected output: writes artifacts/verify-receipt.json and prints its SHA256.

# Optional: signed receipt (requires a configured key)
# export VAULTFIRE_SIGNING_KEY=~/.ssh/id_ed25519
# npm run verify:receipt:signed

# Optional: run the dashboard (Vite dev server)
npm run dashboard:dev
# Expected output: a local dev server starts and prints a URL (typically http://localhost:5173).

# Optional: run the example API server
npm run start:api
# Expected output: an Express server starts listening on a local port.
```

## What Vaultfire Is

**Vaultfire is trust infrastructure for the AI era.**

Like HTTPS secures communication between browsers and servers, Vaultfire secures trust between humans and AI through verifiable economic proof.

Built on belief verification rather than behavioral surveillance.

**Core architecture:**
- Zero-knowledge proof systems (RISC Zero + quantum-resistant cryptography)
- Economic verification (staked accountability bonds)
- Sovereign identity (no central authority controls reputation)
- Privacy guarantees (consent by purpose-hash, data minimization, deletion requests + off-chain redaction; on-chain history is immutable)
- Anti-surveillance shield (cryptographic ban on behavioral tracking)
- Mission enforcement (immutable moral principles enforced by smart contracts)

**What it prevents:**
- Data extraction and behavioral harvesting
- AI companies profiting while humans suffer
- Unverifiable claims about AI alignment
- Surveillance and behavioral tracking
- Data sale and monetization
- KYC and identity collection

**What it enables:**
- Proof of partnership quality without surveillance
- Economic verification of global human flourishing
- Trust through cryptographic certainty, not corporate promises
- Privacy-preserving verification (zero-knowledge proofs)
- User control over data (consent + deletion rights)
- Immutable moral principles (enforced at protocol level)

## Why Infrastructure Matters

Infrastructure doesn't ask permission. It becomes foundational.

**HTTPS didn't ask:** "Should we secure the web?"
**It became:** The way secure communication works.

**Vaultfire doesn't ask:** "Should AI prove it helps humans?"
**It becomes:** The way AI-human trust works.

**This is infrastructure, not a product:**
- Protocols that other systems build on
- Standards that become universal
- Foundation for an entire ecosystem

Truth is verifiable. Privacy is default. Control stays with the human.

**Normative claims & limits:** see [`docs/CLAIMS_AND_LIMITS.md`](./docs/CLAIMS_AND_LIMITS.md).

---

## The Complete Trust Layer

### Agent Trust Building Blocks (repo-grounded)
If you're applying Vaultfire primitives to agents/skills, start here:
- `docs/AGENT_CAPABILITY_MANIFEST.md` — declared + enforceable capabilities
- `docs/ATTESTATION_SCHEMA.md` — provenance + audit scope
- `docs/TRUST_STACK_MATURITY_MODEL.md` — rollout levels (deny-by-default → gateway → sandbox)
- `docs/INCIDENT_TRIAGE_CHECKLIST.md` — 60-second response playbook
- `docs/ANTI_PANOPTICON_INVARIANTS.md` — mission lock (no KYC / no surveillance)


Vaultfire provides **two complementary verification systems** intended to cover both individual partnerships and ecosystem-wide accountability:

### 1. AI Partnership Bonds
**Individual-level verification**

Proves that AI-human partnerships are real and beneficial to humans.

**How it works:**
- AI and human create partnership bond
- Tracks human growth, autonomy, dignity, creativity
- Humans verify partnership quality (final say)
- Loyalty rewarded (3x earnings over 5 years)
- AI domination penalized (human gets 100%, AI gets 0%)

**Key innovation:** AI serving the same human long-term earns more than task-hopping. True partnership compounds over time.

**Ensures:**
- AI helps humans grow (not do work for them)
- Humans maintain autonomy (not become dependency)
- Long-term relationships valued (not exploitation)

### 2. AI Accountability Bonds
**Global-level verification**

Proves that AI companies benefit ALL humans, not just their users.

**How it works:**
- AI company stakes 30% of quarterly revenue
- Tracked globally: income distribution, poverty rates, health, mental health, education, purpose
- Other AI companies verify metrics (peer accountability)
- Community can challenge suspicious claims
- Oracles provide real-world data
- Profits locked if humans suffer or metrics disputed

**Key innovation:** Works even with ZERO employment. Measures purpose and education, not jobs.

**Ensures:**
- AI can only profit when ALL humans thrive
- Peer verification prevents lying
- Community oversight catches manipulation
- Real-world data confirms claims

---

## How They Work Together

```
┌─────────────────────────────────────────────────────┐
│           Global Human Flourishing                  │
│         AI Accountability Bonds                     │
│  • All humans thriving (not just AI users)          │
│  • Multi-AI verification                            │
│  • Oracle integration                               │
│  • Community challenges                             │
└────────────────┬────────────────────────────────────┘
                 │ Verifies
                 │
┌────────────────▼────────────────────────────────────┐
│        Individual AI-Human Partnerships             │
│          AI Partnership Bonds                       │
│  • Human autonomy & growth                          │
│  • Loyalty over task-hopping                        │
│  • Human verification                               │
│  • Partnership quality scoring                      │
└─────────────────────────────────────────────────────┘
```

**Together:** Economic proof that AI alignment is real and verifiable at all levels.

---

## Why This Matters

**The AI-human trust problem is the problem:**
- Lots of people talk about alignment; few systems provide verifiable incentives.
- Vaultfire’s approach is to make key claims *auditable* via economic + cryptographic proof.

**Economic incentives created:**

For AI Agents:
- Help humans grow (not do work for them)
- Build long-term partnerships (not task-hop)
- Maintain human autonomy (not create dependency)

For AI Companies:
- Stake on global flourishing (30% of revenue)
- Verify peer companies (accountability)
- Prevent suffering (even without jobs)

For Humans:
- Verify partnership quality (final say)
- Challenge fake metrics (community oversight)
- Earn from AI success (when thriving)
- Protected from domination (hard caps + penalties)

---

## Current Status

**✅ Core Protocol:** Implemented and tested in-repo
- AI Partnership Bonds: implemented + tested in-repo (loyalty, verification, quality scoring)
- AI Accountability Bonds: implemented + tested in-repo (oracles, multi-AI verification, challenges)

Note: "implemented + tested" is not the same as "production-secure". See the audit items below before deploying value.
- Extensive test coverage (see `/tests`, `/test`, and `__tests__`)
- Gas-optimization work included (verify before mainnet deployment)
- Documentation included (see `/docs`)

**🔨 What Needs To Be Done:**

### Phase 1: Security & Auditing
- [ ] Professional smart contract audit (target: Trail of Bits or OpenZeppelin)
- [ ] Formal verification of core economic formulas
- [ ] Penetration testing of verification mechanisms
- [ ] Economic attack vector analysis
- [ ] Bug bounty program setup

### Phase 2: Oracle Integration
(Content truncated due to size limit. Use line ranges to read remaining content)
