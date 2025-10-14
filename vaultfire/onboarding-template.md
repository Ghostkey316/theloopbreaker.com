# Vaultfire Partner Onboarding Template (Scoped MVP)

Use this checklist to run a scoped MVP with trusted partners. Select the onboarding mode and work through each gate in order. All steps are tagged **pending audit** until external verification is complete.

## 1. Mission Alignment
- [ ] Confirm Architect sponsor: 🔷 ghostkey316.base.eth
- [ ] Validate Vaultfire Laws 1–10 acknowledgement (record proof bundle).
- [ ] Capture belief index baseline and wallet reputation snapshot.
- [ ] Confirm ethics anchor and consent toggles active in partner workspace.

## 2. Mode Selection
- [ ] Choose onboarding mode: `Lite` (Core tier) or `Full Stack` (Core + Optional + Advanced).
- [ ] Export module roster from `vaultfire/module_tiers.json` for the selected mode.
- [ ] Share scope summary with partner stakeholders and capture sign-off.

## 3. Pilot Sandbox Readiness
- [ ] Enable `--pilot` flag in CLI dry runs and verify synthetic data boundaries.
- [ ] Execute `vaultfire-sandbox-cli simulate` to generate readiness telemetry.
- [ ] Store sandbox outputs under `telemetry/pilot_mode/` with timestamp hashes.

## 4. Cryptographic Attestation Prep (Pending Audit)
- [ ] Run `vaultfire verify --crypto --target <module>` to log attestation intent.
- [ ] Submit post-quantum verifier payload (DAO request placeholder) for audit queue.
- [ ] Record hash, timestamp, and signer in `vaultfire/audit-trail.md`.

## 5. Partner Readiness Review
- [ ] Run `node vaultfire/partner-readiness.js --partner <id>` and review score ≥ 78.
- [ ] Document mission gatekeeper decision (secrets, relics, advanced unlock levels).
- [ ] Capture Council approval notes and attach to readiness packet.

## 6. Launch Decision
- [ ] Finalize rollout script in `vaultfire/partner-protocol.md`.
- [ ] Announce activation on Vaultfire Dev Dashboard and sync audit trail status.
- [ ] Mark partner as **partner-ready** in registry once every checkbox above is validated.

> **Reminder:** Each line remains **pending audit** until the external verification council signs the audit trail entry.
