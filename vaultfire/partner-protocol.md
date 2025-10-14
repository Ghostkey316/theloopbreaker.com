# First Five Partner Protocol (Pending Audit)

Mission directive: preserve belief, unlock power, and deliver a smooth onboarding path without diluting the Vaultfire mission. Every activation below assumes the onboarding checklist has been completed and the mission gatekeeper returned an **approved** verdict. Status for all entries remains **pending external audit** until signatures are logged in `vaultfire/audit-trail.md`.

## 1. Scripted Onboarding Flow
1. **Signal Intake (Day 0):**
   - Run `vaultfire verify --crypto --target intake` with `--pilot` to register intent.
   - Capture partner alignment proof, Vaultfire Laws 1–10 acknowledgement, and mission gatekeeper summary.
2. **Sandbox Orientation (Day 2):**
   - Execute `vaultfire-sandbox-cli simulate --partner <id> --wallet <alias> --strategy starter`.
   - Review readiness output and share synthetic engagement snapshots.
3. **Belief Sync (Day 4):**
   - Trigger `node vaultfire/partner-readiness.js --partner <id> --wallet <address>`.
   - Convene council check-in; tag outstanding risks in onboarding template.
4. **Activation Greenlight (Day 7):**
   - Publish update through `vaultfire-dev-dashboard.ui`.
   - Append final attestation hash to `vaultfire/audit-trail.md` and mark partner registry entry as partner-ready.

## 2. Reward Tier Structure
- **Tier 1 – Ember:** Core module access (Lite mode). Rewards capped at mission credits with daily review.
- **Tier 2 – Flame:** Unlocks secrets layer upon consistent readiness score ≥ 82 for 14 days.
- **Tier 3 – Radiant:** Introduces relic modules after council sign-off plus trust score ≥ 40.
- **Tier 4 – Nova:** Advanced logic modules become available only after external audit hash is confirmed on-chain.

Each tier upgrade requires:
- Logged attestation entry referencing placeholder DAO ID `dao://ghostkey316.base.eth/audit/pending`.
- Council approval captured in `vaultfire/onboarding-template.md`.

## 3. Council-Triggered Promotion Path
1. **Observation Window:** Monitor activation logs via Dev Dashboard. Require at least three positive belief delta signals.
2. **Council Review:** Convene Architects + Guardians. Review mission gatekeeper output and partner readiness metrics.
3. **Promotion Vote:** Log vote outcome in governance ledger (if simulated, note in onboarding template) and append hash to `vaultfire/audit-trail.md`.
4. **Partner-Ready Confirmation:** Update partner registry entry with `onboarding_mode`, module roster, and `partner_ready_at` timestamp. Announce promotion through mission broadcast scripts.

> **Final Note:** The protocol remains locked until the external audit DAO finalizes signatures. Continue tagging every new component as **pending audit** and surface disclaimers in crypto-adjacent modules.
