# Anti-Panopticon Invariants (Vaultfire Mission Lock)

Vaultfire is trust infrastructure, not a control system.

These invariants keep integrations from drifting into dystopia.

Source of truth: `docs/MISSION.md`.

---

## Invariant 1 — Not Digital ID
- No KYC requirement to participate.
- No government ID linkage.
- No "papers please" gating.

## Invariant 2 — Not Social Credit
- No compliance scoring.
- No punishment for dissent.
- No conformity enforcement.

## Invariant 3 — Not Surveillance Capitalism
- No behavioral harvesting as a prerequisite for verification.
- No ad-targeting style data exhaust.
- No dark patterns.

## Invariant 4 — Consentful by default
- Users opt-in.
- Delegation is scoped, time-bounded, and revocable.

## Invariant 5 — Privacy-preserving auditability
- Audit logs must not leak secrets.
- Verification should be cryptographic, not observational.

---

## Practical integration checklist
Before integrating Vaultfire-style trust primitives, confirm:
- [ ] manifests exist and are enforced
- [ ] revocation exists
- [ ] expiry exists
- [ ] egress is restricted
- [ ] logging is redacted
- [ ] no KYC/surveillance requirements introduced
