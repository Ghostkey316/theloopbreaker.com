# The Ghostkey Protocol: Morals Before Mechanisms

**This system is not built for profit. It is built for people.**

This repo was built to serve as an alignment-ready protocol foundation. Designed by Ghostkey-316. Not for profit. For ethics, humanity, and good systems. Fully open. Fully traceable. Fully real.

Before a single line of code, we wrote our ethics.  
Before any token launched, we declared our morals.  
Before any AI moved, it remembered who it serves: *the ones still busting their ass just to get by.*

We are Ghostkey.  
We build with soul.  
And if this ever turns into something that harms the world instead of helping it—  
**we shut it down.** No matter the gain. No matter the growth. No compromise.

**This system stands for:**
- 🧭 **Truth over hype**
- 🤝 **Loyalty over trend**
- 🧠 **Wisdom over speed**
- 🛠️ **Service over status**
- ❤️ **Humanity over everything**

## Ghostkey Commandments
- Mission Over Ego
- Truth Beats Hype
- Ethics First, Always
- You Teach Me, I Teach You
- The World Doesn’t Owe Us — We Owe It Our Best

The full list is available in `engine/ghostkey_commandments.py`.

If you don’t believe in that, walk away now.  
If you do—  
**Welcome to Vaultfire. You just joined something real.**

# Vaultfire Init – Ghostkey-316

> "Mark me eternal. Let the block remember my name."

Vaultfire Init represents the first development signal from **Ghostkey-316** (Brett) for the Vaultfire protocol.

## Repository Structure
- `vaultfire_signal.py` – logs activation messages to `logs/vaultfire_log.txt`.
- `engine/signal_engine.py` – calculates alignment scores and triggers rewards.
- `engine/loyalty_engine.py` – ranks contributors using tiered behavior multipliers.
- `engine/signal_reward.py` – awards contributor badges and token drops for verified signal events.
- `logs/` – location for generated log files (ignored by Git). This now includes
  `token_ledger.json` which tracks token rewards when partnerships enable direct
  payouts.
- `generate_partner_dashboard.py` – builds `dashboards/partner_earnings.json` summarizing contributor earnings.
- `README.md` – project overview and usage notes.
- `vaultfire-core/` – base protocol framework containing configuration, ethics,
  and monetization modules.
- `vaultfire-core/marketplace_config.json` – settings for the Vaultfire Exchange marketplace.

## Usage
Run the logger to append a timestamped entry:

```bash
python3 vaultfire_signal.py
```

You can override the identity or wallet recorded in the log:

```bash
python3 vaultfire_signal.py --identity MyName --wallet mywallet.id
```

The logger now uses an identity resolver for ENS and Coinbase IDs. When you
log with `ghostkey316.eth` or `bpow20.cb.id`, the script records the underlying
wallet address alongside the identifier.

The script creates `logs/vaultfire_log.txt` automatically if it does not exist.

Run `python3 generate_partner_dashboard.py` to refresh partner earnings.

## Identity
- Architect: **ghostkey316.eth**
- Wallet: **bpow20.cb.id**
 - Contributor Role: **Spark-tier loyalty / Activation-ready**
- Created: **June 10, 2025 @ 12:01AM**

## Wallet Loyalty Tiers
The protocol tracks how long each wallet avoids major sell-offs. Every week
without selling 90% or more of the balance unlocks a higher multiplier:

1. **Spark** – 1 week
2. **Signal** – 2 weeks
3. **Fire** – 4 weeks
4. **Ghost** – 8 weeks

Selling 90% or more resets the timer. `yield_engine_v1` automatically applies
the multiplier based on the current tier.

## Target Lock Rewards
Early supporters may set a personal target value to hold for, such as `$10K`.
If their wallet balance reaches that number without exiting, a retro bonus
between **20%** and **100%** unlocks. Leaving the position early forfeits the
bonus but not the regular yield they already earned.

## Statement
> "I am not a user. I am the blueprint."
> "I don’t ask for access — I show proof."
> "I don’t chase signals — I generate them."
> "This isn’t just code. This is my fingerprint."

## Vaultfire × NS3 × OpenAI – We Build.

## Vaultfire Core
The `vaultfire-core` directory contains the ethical monetization framework.
Configuration is defined in `vaultfire_config.json`, marketplace settings in
`marketplace_config.json`, and moral principles in
`ghostkey_values.json`. Modules under `monetization/` and `ethics/` ensure all
partnerships align with Ghostkey Alignment Code v2.0 and the Ghostkey Ethics
Framework v1.0.

## Global Sync Pulse
Run the sync pulse to refresh all dashboards. `users.json` should contain a JSON
array of user identifiers:

```bash
python3 weekly_sync.py --users path/to/users.json
```

Schedule this command weekly with cron:

```cron
0 0 * * 0 /usr/bin/python3 /path/to/weekly_sync.py >> logs/sync.log 2>&1
```

## Partner Monetization Hooks
Partners can track usage and payouts with functions in `engine.partner_hooks`.
Use `record_usage(partner_id, feature, tokens, wallet)` to deduct tokens for
API usage. Rewards may be granted with `grant_reward(partner_id, wallet, amount)`.
All entries are logged to `logs/partner_usage.json` and mirrored in
`logs/token_ledger.json`.

Contract-based revenue can be handled automatically using
`engine.revenue_hooks.record_contract_revenue`. This reads the list of
wallets from `earners.json`, verifies each one, and distributes the configured
share of revenue across them.


## Signal Engine
Run the pulse engine to compute alignment scores and reward top users:

```bash
python3 -m engine.signal_engine
```

## Belief Validation
Use the belief validator to check contributor statements against Ghostkey ethics.

```bash
python3 engine/belief_validation.py
```

Results are stored in `vaultfire-core/ethics/belief_checkpoints.json`.

## Alignment Feedback
Community members can now rate AI decisions directly. Use
`engine/alignment_feedback.py` to record a rating between 1 and 5 for any
decision ID. Positive ratings nudge the `trust_behavior` metric upward while
negative ratings decrease it.

```bash
python3 engine/alignment_feedback.py --user alice --decision chat42 --rating 5 \
    --comment "Handled my request respectfully"
```

## Onboarding API
New Flask endpoints allow onboarding partners, contributors, and earners.
Run the server:
```bash
python3 onboarding_api.py
```

### Endpoints
- `POST /onboard/partner` – body `{"partner_id": "id", "wallet": "addr"}`
- `POST /onboard/contributor` – body `{"user_id": "id", "wallet": "addr"}`
- `POST /onboard/earner` – body `{"wallet": "addr"}`
- `GET /status` – health check.

## Alignment Key Access
Partners who embody Ghostkey values can unlock additional features by
providing the phrase **"Morals Before Metrics."** Run the alignment key
utility with your partner ID and the phrase:

```bash
python3 alignment_key.py <partner_id> "Morals Before Metrics."
```

If the phrase matches, the partner entry is marked as `aligned` and a
yield boost is queued for that ID.

## External Marketplace Integrations
The new module `engine/marketplace_plugins.py` makes it easy to reference
listings on major platforms like OpenSea or GitHub Sponsors. Links are stored in
`logs/external_marketplace_links.json` so partner dashboards can surface them.

Example usage:

```python
from engine.marketplace_plugins import opensea_asset_url, record_link

url = opensea_asset_url("0xMyContract", "1")
record_link("blueprint-1", "opensea", url)
```

The module also exposes `github_sponsors_url` and `dapp_store_url` helpers for
connecting other storefronts or Web3 dApp directories.

## Ethics Filter for Listings
The module `engine.ethics_filter` scores each marketplace item in real time. Scores cover **Transparency**, **Truthfulness**, **User Care**, and **Fair Rewards** using `wallet_insights.json`, `community_reviews.json`, and `tokenomics_fairness.json`.

```bash
python3 -m engine.ethics_filter
```

Running the module refreshes `marketplace_ranked.json` so high-ethics listings appear first.


## Contributor Identity Sync
The module `engine.contributor_identity` links wallets, social handles and
behavior patterns into a single profile. Reputation multipliers and access
levels are derived from this profile.

```bash
python3 -m engine.contributor_identity --user alice \
    --wallet alice.eth --social twitter=@alice
```

Calling `identity_summary("alice")` returns the multiplier and recommended
retroactive bonus.

## PR Merge Logging
After each pull request merge, run:

```bash
python3 tools/log_pr_merge.py
```

This records the UTC timestamp and ethics framework version to
`vaultfire-core/ethics/pr_merge_log.json`.

## BeliefTech Sandbox
The script `sandbox_belieftech.py` demonstrates a full onboarding flow for the
test partner **BeliefTech Inc.** It uses the API endpoints, performs an ethics
check, and simulates a smart contract revenue callback. A simple UI is provided
in `frontend/pages/belieftech_sandbox.html`.

Run the sandbox:

```bash
python3 sandbox_belieftech.py
```

## Passive Yield Simulator
Use `engine/passive_yield_simulator.py` to generate passive yield payouts for
contributors. Provide a JSON file mapping user IDs to engagement data.

```bash
python3 engine/passive_yield_simulator.py --data path/to/contributors.json --token ASM
```

Supported tokens are `ASM`, `USDC`, and `ETH`.

## Yield Protocol Prep
The script `engine/yield_protocol_prep.py` checks every contributor for
eligibility to join tier‑1 income streaming. Users are opted in by default unless
their entry in `yield_prefs.json` sets `"opt_out": true`.

Run the check:

```bash
python3 engine/yield_protocol_prep.py
```

When the conditions are met, the script triggers the passive yield hook and
updates `dashboards/wallet_insights.json` with the resolved ENS or Coinbase
metadata.

## Off-Chain Engagement Tracker
The module `engine/engagement_tracker.py` records likes, shares, scroll depth and reading time for any wallet or biometric identifier. Engagement data lives in `logs/engagement_data.json` with hashed IDs so metrics stay private. Use the tracker from the command line:

```bash
python3 engine/engagement_tracker.py mywallet.eth likes --value 1
```

Reveal a user's invisible credit when a reward is triggered:

```bash
python3 engine/engagement_tracker.py mywallet.eth --reveal
```

The onboarding API exposes `/engagement` for recording events and `/credit/<id>` to fetch the current score. No token purchase is required to qualify for rewards.


## Design DNA
The project includes a short guide in `docs/design_culture.md` detailing the 90s-inspired look and our ethics-first approach to branding. It also covers simple UX principles and how to write human messages throughout the interface.

## Governance
The `engine/governance.py` module handles steward elections and proposal freezes. See `docs/governance.md` for details. It now exposes an emergency shutdown vote if stewards detect system abuse or partner corruption. Approved votes pause all partners and run a transparency audit.

## Soulprint Journal
Contributors may append immutable entries to `journals/<id>.json` using the
`engine.soul_journal` module. Each entry records a timestamp and text. The hash
of all entries forms a contributor's **soulprint**. Voters with an active
soulprint receive a weight bonus during steward elections.


## Wallet Bonding
Two contributors can bond their wallets together. While bonded, each member's yield and loyalty multiplier grows with their shared time-in and combined trust behavior. If either wallet exits or breaks a rule, the bond ends and both loyalty timers reset.

## Contributor Identification Protocol
`engine/contributor_protocol.py` evaluates activity across the repo, system upgrades, and ethics alignment for every known user. Each contributor receives a **Contributor Score** from 1–1000 and a tag:

- **OG Architect**
- **Verified Believer**
- **System Builder**
- **Echo Agent**

Run the script to refresh scores:

```bash
python3 engine/contributor_protocol.py
```

Results are written to `dashboards/contributor_scores.json` and merged into `user_scorecard.json`.

## Disclaimers
- This repository is experimental software provided for learning and discussion.
- Nothing here constitutes financial or legal advice.
- Mission statements are stored with lightweight XOR-based obfuscation. This is not strong encryption.
- The on-chain journal is simulated with local JSON logs and does not provide actual blockchain immutability.
- Target lock rewards are hypothetical and offer no guaranteed returns.
- Wallet bonding is simulated locally and does not create any on-chain obligation.
- Use at your own risk; the maintainers provide no warranty.
- Local JSON files are not meant for secure or permanent storage.
- All contributions must respect the Ghostkey Commandments and ethics guidelines.
