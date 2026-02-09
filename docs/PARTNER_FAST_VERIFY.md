# Partner Fast Verify (15-30 minutes)

This page is for teams evaluating Vaultfire as **trust infrastructure** for Human<->AI and AI<->AI coordination.

Vaultfire’s core claim is simple:

- Trust should be **verifiable** (cryptographic + economic proof)
- Privacy should be **default** (no behavioral surveillance, no KYC)
- Incentives should be **auditable** (alignment as mechanism, not marketing)

## What you can verify locally

In this repo, you can run:

- `npm run verify` — runs preflight + tests and writes a verification receipt.
- `npm run verify:signed` — same, but requires an OpenSSH-signed receipt tied to your local SSH key.

Outputs (in `artifacts/`):
- `verify-receipt.json`
- `verify-receipt.sha256`
- optional: `verify-receipt.sig` + `verify-receipt.allowed_signers`

Receipt details (schema + threat-model notes): see [`VERIFY_RECEIPTS.md`](./VERIFY_RECEIPTS.md).

## Integration surfaces (practical)

Vaultfire is designed to be integrated as **primitives**, not a monolith.

Common surfaces:

- **Attestations + manifests** for agents/skills
  - `docs/AGENT_CAPABILITY_MANIFEST.md`
  - `docs/ATTESTATION_SCHEMA.md`
- **Trust stack maturity model** (roll out gradually)
  - `docs/TRUST_STACK_MATURITY_MODEL.md`
- **Incident response** for agent systems
  - `docs/INCIDENT_TRIAGE_CHECKLIST.md`
- **Anti-panopticon invariants** (hard no-go zones)
  - `docs/ANTI_PANOPTICON_INVARIANTS.md`

## Pilot options (choose one)

### Pilot A: Signed receipts for agent actions (coordination primitive)

Goal: make agent runs auditable without shipping logs or PII.

Deliverables:
- receipt generation for a partner-defined workflow
- signed receipts stored alongside artifacts (CI or local)
- verification script + docs for reviewers

Success metric:
- an external reviewer can validate: "this run happened, against this code, by this signer identity".

### Pilot B: Attestation + capability manifest (trust boundary primitive)

Goal: make agent capability boundaries explicit and enforceable.

Deliverables:
- capability manifest for a representative agent
- attestation describing provenance + audit scope
- maturity-level recommendation + incident checklist mapping

Success metric:
- partner can prove (internally) what an agent is allowed to do, and detect drift.

### Pilot C: Partnership/Accountability bond model review (economic primitive)

Goal: evaluate incentive design and auditability.

Deliverables:
- mapping from claimed incentive -> mechanism -> tests/docs
- list of required external dependencies (oracles, audits, etc.)

Success metric:
- partner can clearly state what is and is not proven today.

## Target partner notes

### AI Labs
Why this exists:
- move from "trust us" alignment claims to **auditable incentives**
- avoid surveillance-based safety theater

What we’d ask for in a first integration:
- pick one high-value workflow (agent deployment, eval run, incident response)
- require signed receipts + explicit capability manifests

### Coinbase / Base ecosystem
Why this exists:
- trust primitives that can live inside wallets + onchain apps without KYC
- reference Base mini-app in `/base-mini-app`

First integration candidate:
- signed receipts + attestations for a Base mini-app flow

### Assemble AI
Why this exists:
- coordination across agent networks needs verifiable boundaries
- receipts + attestations let teams reason about trust without shipping raw traces

## Claims, limits, and honesty

Vaultfire avoids over-claims.

- Normative claims & limits: [`CLAIMS_AND_LIMITS.md`](./CLAIMS_AND_LIMITS.md)
- Threat model: `docs/security/THREAT_MODEL.md`

## Next step

Reply with:
- your org type (AI lab / agent platform / wallet / infra)
- one workflow you want to make verifiable
- whether you want Pilot A, B, or C

We’ll respond with a 1-2 page pilot spec and a checklist that can be executed in two weeks.
