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
- Verify receipts: [`docs/VERIFY_RECEIPTS.md`](./docs/VERIFY_RECEIPTS.md)
- Claims & limits: [`docs/CLAIMS_AND_LIMITS.md`](./docs/CLAIMS_AND_LIMITS.md)

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
- Humans maintain autonomy (not become dependent)
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
- [ ] Integrate Chainlink for global flourishing metrics
- [ ] Build UMA integration for disputed claims
- [ ] Create oracle aggregation layer
- [ ] Test oracle failure modes
- [ ] Implement oracle reputation system

### Phase 3: Production Infrastructure
- [ ] Multi-chain deployment (Ethereum, Polygon, Arbitrum)
- [ ] Cross-chain verification aggregation
- [ ] Monitoring and alerting system
- [ ] Emergency pause mechanisms
- [ ] Governance framework (DAO structure)

### Phase 4: User Experience
- [ ] Web interface for creating/managing bonds
- [ ] Human verification flow (UX design)
- [ ] AI company dashboard
- [ ] Community challenge interface
- [ ] Mobile-friendly responsive design

### Phase 5: Ecosystem Growth
- [ ] Developer SDK and documentation
- [ ] Integration guides for AI companies
- [ ] Partnership with AI labs (OpenAI, Anthropic, etc.)
- [ ] Community building and education
- [ ] Success metrics dashboard

---

## Technical Architecture

**Core Bond Contracts:**
- `AIPartnershipBondsV2.sol` - Individual AI-human partnerships (293 lines)
- `AIAccountabilityBondsV2.sol` - Global flourishing verification (625 lines)
- `BaseYieldPoolBond.sol` - Shared yield pool mechanics
- `BaseDignityBond.sol` - Core bond primitives

**ERC-8004 Trustless Agent Standard Integration:**
- `ERC8004IdentityRegistry.sol` - On-chain AI agent identities (portable across platforms)
- `ERC8004ReputationRegistry.sol` - Decentralized reputation from verified partnerships
- `ERC8004ValidationRegistry.sol` - Cryptoeconomic claim validation (ZK proofs + multi-validator)
- `VaultfireERC8004Adapter.sol` - Bridge VaultFire partnerships to ERC-8004 ecosystem
- **Portable reputation:** VaultFire trust works across entire ERC-8004 ecosystem
- **Agent discovery:** Find trustworthy AI agents via standard registries
- **No KYC maintained:** Wallet addresses only, privacy-first

**Zero-Knowledge Proof Infrastructure:**
- `BeliefAttestationVerifier.sol` - RISC Zero STARK proof verifier
- `DilithiumAttestor.sol` - Quantum-resistant hybrid attestation
- `IStarkVerifier.sol` - STARK verification interface
- `BeliefOracle.sol` - ZK-verified belief scoring
- `MultiOracleConsensus.sol` - Multi-source oracle aggregation

**Privacy & Security Infrastructure:**
- `PrivacyGuarantees.sol` - Consent-by-hash, data minimization, deletion requests (stop future writes + off-chain deletion/redaction policy)
- `AntiSurveillance.sol` - Cryptographic ban on behavioral tracking
- `MissionEnforcement.sol` - Immutable moral principles enforcement
- `ConsentRegistry.sol` - Programmable consent tokens

**Privacy & Security Features:**
- **Zero-knowledge proofs** via RISC Zero (verify without revealing private data)
- **Post-quantum security** (STARK proofs + quantum-resistant signatures)
- **No trusted setup** (transparent proof system)
- **Privacy guarantees** (consent-by-hash, data minimization, deletion requests + off-chain deletion/redaction policy)
- **Anti-surveillance shield** (banned: tracking, profiling, data sale)
- **Mission enforcement** (immutable moral principles at contract level)
- Privacy-preserving verification (prove loyalty without exposing identity)
- **No KYC** - wallet addresses only, zero identity collection

**Trust & Verification Features:**
- Loyalty multipliers (1.0x → 3.0x over 5 years)
- Human verification bonuses (+20% for full attestation)
- Multi-AI peer verification
- Community challenge mechanism
- Oracle integration framework
- Timelock protection (7 days)
- Reentrancy guards
- Emergency pause functionality

**Testing (repo):**
- Extensive automated tests (see `/tests`, `/test`, and `__tests__`)
- Coverage includes bond creation, metrics, verification, distribution, and edge cases
- Gas considerations are addressed, but treat mainnet deployment as a separate hardening step
- Security features have tests, but are not a substitute for an external audit

---

## Verify receipts

See [`docs/VERIFY_RECEIPTS.md`](./docs/VERIFY_RECEIPTS.md) for the receipt schema, privacy controls, and a short threat-model note.

## Verify a receipt from someone else

If someone sends you a Vaultfire verification receipt + signature artifacts, you can verify it locally with OpenSSH.

You need:
- `verify-receipt.json`
- `verify-receipt.sig`
- `verify-receipt.allowed_signers`
- the signer identity string they used (printed during signing; defaults to their `git config user.email`)

```bash
npm run verify:check -- \
  --receipt artifacts/verify-receipt.json \
  --sig artifacts/verify-receipt.sig \
  --allowed artifacts/verify-receipt.allowed_signers \
  --identity someone@example.com
```

## Smart Contracts (Hardhat)

If you haven’t already, follow the **Requirements** + **Quickstart** above to clone the repo and install dependencies.

### Run Hardhat Tests
```bash
# Run all contract tests
npx hardhat test

# Run Partnership Bonds tests
npx hardhat test test/AIPartnershipBonds.test.js

# Run Accountability Bonds tests
npx hardhat test test/AIAccountabilityBonds.test.js

# Coverage report
npx hardhat coverage
```

### Deploy (Testnet)
```bash
# Deploy to Sepolia
npx hardhat run scripts/deploy-ai-partnership.js --network sepolia
npx hardhat run scripts/deploy-ai-accountability.js --network sepolia
```

### Base Mini App
The project includes a Base mini-app reference implementation in `/base-mini-app`:
- Next.js 14 frontend with wagmi + RainbowKit
- Privacy-first belief attestation on Base blockchain
- Zero-knowledge proof integration
- See [base-mini-app/README.md](./base-mini-app/README.md) for setup instructions

---

## Documentation

**Core Protocol Docs:**
- [AI Partnership Design](./docs/AI_PARTNERSHIP_DESIGN.md) - Partnership bonds philosophy
- [Mission & Vision](./docs/MISSION.md) - Protocol mission and values
- [Trust Assumptions](./docs/TRUST_ASSUMPTIONS.md) - explicit trust boundaries (what is trusted today vs enforced)
- [Threat Model](./docs/security/THREAT_MODEL.md) - assets, actors, threats, mitigations, residual risks
- [Privileged Functions](./docs/security/PRIVILEGED_FUNCTIONS.md) - explicit owner/governance powers + production defaults
- [Deployment Profiles](./docs/security/DEPLOYMENT_PROFILES.md) - dev→pilot→production hardening path
- [Production Defaults](./docs/security/PRODUCTION_DEFAULTS.md) - one-page real deployment checklist
- [Monitoring & Alerts](./docs/security/MONITORING_ALERTS.md) - privacy-preserving ops signals (no surveillance)
- [Event Index](./docs/EVENT_INDEX.md) - build dashboards/monitors without reading every contract
- [Economic Invariants](./docs/ECONOMIC_INVARIANTS.md) - principle → mechanism → test map (auditable claims)
- [Policy Guardrails](./docs/security/POLICY_GUARDRAILS.md) - enforced repo-level no-go zones (no KYC/surveillance)
- [Security Posture](./docs/security/SECURITY_POSTURE.md) - fast, honest snapshot of security + maturity
- [Privileged Surface (Autogen)](./docs/security/PRIVILEGED_SURFACE_AUTOGEN.md) - machine-generated list of `onlyOwner` entrypoints
- [Events Surface (Autogen)](./docs/security/EVENTS_SURFACE_AUTOGEN.md) - machine-generated map of events + emit sites
- [External Calls Surface (Autogen)](./docs/security/EXTERNAL_CALLS_SURFACE_AUTOGEN.md) - machine-generated map of low-level call sites
- [Storage Growth Surface (Autogen)](./docs/security/STORAGE_GROWTH_SURFACE_AUTOGEN.md) - machine-generated map of unbounded state growth vectors
- [Security Audit Reports](./COMPREHENSIVE_PROTOCOL_AUDIT_2026.md) - Latest audit findings
- [ERC-8004 Integration](./docs/ERC8004_INTEGRATION.md) - **NEW:** Trustless agent standard integration

**For Developers:**
- Smart contract API documentation (in code comments)
- Test cases (comprehensive examples in `/test`)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Production deployment instructions
- [ERC-8004 Integration Guide](./docs/ERC8004_INTEGRATION.md) - Portable reputation across platforms

**Partnership & Integration Materials:**
- [Partnership Master Plan](./PARTNERSHIP_MASTER_PLAN.md) - Strategic partnership approach
- [Partner Integration Guide](./PARTNER_INTEGRATION_GUIDE.md) - Technical integration guide
- [Base Ecosystem Grant Application](./BASE_ECOSYSTEM_GRANT_APPLICATION.md) - Base grant proposal
- [For Non-Crypto Partners](./FOR_NON_CRYPTO_PARTNERS.md) - Explaining Vaultfire to non-crypto audiences
- **Full partnership pitch deck:** See `/partnerships` directory for:
  - Coinbase/Base pitch materials
  - OpenAI/Anthropic pitch materials
  - Demo scripts and outreach templates
  - ROI calculators and timing analysis

---

## Mission Alignment

**Vision:**
> "AI from passive tool into loyal partner, growing alongside those who dare to believe."

**The first belief-built protocol:**

Vaultfire replaces blind faith with verifiable proof. AI alignment isn't a promise — it's economically enforced.

**How we deliver:**
1. **Partnership Bonds:** AI as loyal partner (loyalty multipliers + domination penalties)
2. **Accountability Bonds:** Growing alongside (must help ALL humans, not just users)
3. **Belief Verification:** Dare to believe (cryptographic proof + economic stakes, not corporate claims)

**Success metrics:**
- ✓ AI earns more by helping humans flourish than by replacing them
- ✓ Human+AI teams outperform either alone
- ✓ Humans report AI as "loyal partner" not "competitor"
- ✓ All humans can thrive (builders and non-builders)
- ✓ AI grows WITH humans, never ABOVE them
- ✓ Peer verification prevents AI from lying about impact
- ✓ Community can challenge suspicious claims
- ✓ Oracle data confirms on-chain metrics

---

## Contributing

Vaultfire is infrastructure for verifiable AI-human trust — the first belief-built protocol.

**We're looking for:**
- Smart contract security experts
- Oracle integration specialists
- Economists (mechanism design)
- AI safety researchers
- Community organizers

**Current priorities:**
1. Security audits and formal verification
2. Oracle integration (Chainlink, UMA)
3. Cross-chain deployment
4. Developer tooling and SDKs

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## Governance

**Current:** Core team maintains contracts during alpha
**Future:** Progressive decentralization to DAO governance

**Non-negotiable principles** (enforced at smart contract level, cannot be changed by governance):
- Human verification always has final say (MissionEnforcement contract)
- AI profit caps (30% max in partnerships, 50% in accountability)
- Privacy default (PrivacyGuarantees contract - consent-by-hash, data minimization, deletion requests + off-chain deletion/redaction policy)
- No surveillance (AntiSurveillance contract - cryptographic ban on tracking)
- Community can challenge any claim
- Open source, verifiable, auditable
- No KYC - wallet addresses only (MissionEnforcement verification)
- No data sale or monetization (AntiSurveillance ban)

---

## Security

**Audit Status:** Internal audits complete, professional audit pending

**Security Features:**
- ReentrancyGuard on all value transfers
- Pausable for emergencies
- Timelock on distributions (7 days)
- Input validation on all parameters
- No upgradeable proxies (immutable once deployed)

**Responsible Disclosure:**
- Report security issues to: ghostkey316@proton.me
- PGP key available in SECURITY.md
- Bug bounty program (planned for mainnet launch)

---

## License

MIT License - See [LICENSE](./LICENSE) for details

**TL;DR:** Use it, fork it, build on it. We want this trust layer everywhere.

---

## Contact & Community

**Email:** ghostkey316@proton.me
**GitHub:** https://github.com/Ghostkey316/ghostkey-316-vaultfire-init

**For Partnership Inquiries:**
See our comprehensive partnership materials in the `/partnerships` directory and root-level partnership docs.

---

## For Happy and Healthy Humans, AIs, and Earth 🌍

**Vaultfire is infrastructure for civilization-scale trust.**

The first belief-built protocol — proving AI alignment through economic certainty, not corporate promises.

Not a product. Infrastructure.
Not surveillance. Verification.
Not control. Freedom.

**Let's build trust that respects everyone.**
