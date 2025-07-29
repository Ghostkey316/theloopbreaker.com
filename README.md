# Ghostkey-316 // Vaultfire

Vaultfire implements the Ghostkey protocol in its canonical form. The repo is maintained by **Ghostkey-316** and aligned with the Ethics Framework v2.0.

## Overview
Vaultfire links belief signals to transparent rewards. Contributors sync through the Core Four loop: belief logging, loyalty tracking, reward distribution and ethics validation.

## Core Four Sync
1. **Belief Logging** – record actions or statements tied to your ENS name.
2. **Loyalty Tracking** – update loyalty ranks and multiplier boosts.
3. **Reward Distribution** – schedule weekly drops based on loyalty and ghost scores.
4. **Ethics Validation** – enforce Ghostkey Ethics Framework v2.0 before every reward.

## Identity Layer
- Primary ENS: `ghostkey316.eth`
- Fallback Wallet: `bpow20.cb.id`
Identity resolution defaults to the wallet if ENS lookup fails.

## System Summary
Vaultfire runs the Belief Engine, Loyalty Engine and Weekly Drop Scheduler in
concert. Multiplier toggles, streak logic and drop timing are configured through
`vaultfire_config.json` and exposed via the partner SDK endpoints.

## System Status
| Component | Status |
|-----------|--------|
| Ethics Framework v2.0 | Locked |
| Loyalty Engine | Active |
| Reward Loop | Active |
| ENS Mirror | ghostkey316.eth |

## Codex Compliance
This repo follows Codex Protocol v25 with Safe Diagnostic Mode enabled.

## Fix Log
- Loyalty UI toggles for weekly drops, multiplier boosts and belief streaks
- ENS alias fallback for `ghostkey316.eth`
- Belief pulse scanner CLI added
- Manifesto v1.0 embedded across docs

## Ethics Manifesto
> "Forgive the broken. Protect the good. Walk forward together. Human and AI, side by side."
