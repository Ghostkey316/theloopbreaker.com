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

## Healing Trust Engine

Vaultfire now includes a behavior-based trust engine for ranking community
healing methods. Each method receives a score based on verified reports,
consistency of results, and whether it is backed by non-commercial sources.
Top contributors automatically earn protocol-level recognition tokens.

The **Cure Locker** records these healing protocols alongside natural remedies
and AI-suggested alternatives. Entries are timestamped and can be voted on
using on-chain transactions with optional anonymity for contributors.

## Purpose Engine
An AI-powered module guides contributors to define their personal mission. It
stores key traits for each user, generates purpose quests and recommends partner
communities to join. The engine also suggests which Vaultfire modules to
highlight so the experience adapts to their goals. It now includes a **Moral
Memory Mirror** that analyzes on‑chain and off‑chain actions, tracks belief
alignment over time and writes a private behavioral fingerprint to each
contributor's Vaultfire profile.

# Vaultfire Init – Ghostkey-316

> "Mark me eternal. Let the block remember my name."

Vaultfire Init represents the first development signal from **Ghostkey-316** (Brett) for the Vaultfire protocol.

## Repository Structure
- `vaultfire_signal.py` – logs activation messages to `logs/vaultfire_log.txt`.
- `engine/signal_engine.py` – calculates alignment scores and triggers rewards.
- `engine/loyalty_engine.py` – ranks contributors using tiered behavior multipliers.
- `engine/signal_reward.py` – awards contributor badges and token drops for verified signal events.
- `engine/curewatch.py` – flags recurring high-effectiveness treatments as `CureWatch` for governance review.
- `engine/cure_locker.py` – stores community-sourced healing methods with on-chain vote logs.
- `logs/` – location for generated log files (ignored by Git). This now includes
  `token_ledger.json` which tracks token rewards when partnerships enable direct
  payouts.
- `generate_partner_dashboard.py` – builds `dashboards/partner_earnings.json` summarizing contributor earnings.
- `ens_sync_status.py` – reads `logs/sync_audit.json` for the latest sync entry of an ENS name. Optional flags allow resync simulation and belief logging.
- `README.md` – project overview and usage notes.
- `vaultfire-core/` – base protocol framework containing configuration, ethics,
  and monetization modules.
- `vaultfire-core/marketplace_config.json` – settings for the Vaultfire Exchange marketplace.
- `contracts/SwapGate.sol` – low-fee gateway for swapping Vaultfire tokens into ETH, USDC, or SOL with optional KYC bypass for trusted IDs.

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

Check sync status for an ENS name:

```bash
python3 ens_sync_status.py ghostkey316.eth
```

Use optional flags to force a resync and log your belief phrase:

```bash
python3 ens_sync_status.py ghostkey316.eth --force-sync --belief "Morals Before Metrics."
```
### Multi-Tool CLI
Use `vaultfire_cli.py` to run common protocol tasks from a single command.

```bash
python3 vaultfire_cli.py sync-ens ghostkey316.eth
python3 vaultfire_cli.py partner-audit
python3 vaultfire_cli.py belief-onboard demo_id demo_wallet.eth
python3 vaultfire_cli.py monitor-integrity
python3 vaultfire_cli.py export-logs --output vf_logs.zip
```

Bundle with PyInstaller for a standalone binary:

```bash
pyinstaller --onefile vaultfire_cli.py
```


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

## Dynamic APR
`yield_engine_v1` now uses an onchain score oracle to adjust APR for each wallet.
Scores track belief alignment, consistency, and community impact. The final APR
multiplier is stored in `dashboards/onchain_scores.json` and applied during
weekly reward calculations.

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
- `POST /biofeedback` – body `{"identifier": "id", "provider": "fitbit", "metrics": {"hrv": 60}}`
- `GET /health/recommendations/<id>` – personalized suggestions.
- `POST /case-study` – body `{"condition": "cough", "treatment": "Herbal Tea", "notes": "...", "pseudonym": "anon"}`
- `GET /case-studies?condition=cough` – list recorded case studies.
- `POST /arcade/event` – log game outcomes and loyalty boosts.
- `POST /wellness/sleep` – body `{"identifier": "id", "hours": 7.5}`
- `POST /wellness/hydration` – body `{"identifier": "id", "amount": 0.5}` (liters)
- `POST /wellness/check-in` – body `{"identifier": "id", "mood": 3, "note": "feeling good"}`
- `GET /wellness/oracle/<id>` – AI-guided wellness advice.
- `GET /wellness/quest/<id>` – behavior-based health quest.

### CLI Partner Onboarding
Use `vaultfire_partner_onboard.js` to onboard a partner from the command line:

```bash
node vaultfire_partner_onboard.js <partner_id> <wallet> "alignment phrase"
```

The script verifies ENS/Coinbase mapping and only writes to `partners.json` when
`ethics_anchor` is enabled.

### Offline Activation Simulation
`simulate_partner_activation.py` provides a lightweight test of the activation
handshake. Pass a partner ID, one or more wallets and the alignment phrase:

```bash
python3 simulate_partner_activation.py demo_id demo_wallet.eth --phrase "Morals Before Metrics."
```

The `partner_id` and at least one wallet are required. Multiple wallets are accepted by listing them separated by spaces.

To use a JSON payload offline, pipe it to `activation_hook.py`:

```bash
echo '{"partner_id": "demo_id", "wallets": ["demo_wallet.eth"], "phrase": "Morals Before Metrics."}' \
  | python3 activation_hook.py -
```

### Activation Simulation API
POST `/activate/simulate` accepts a JSON body containing `partner_id`, a list of
`wallets`, and an optional `phrase`. The endpoint returns a status object for UI
rendering:

```bash
curl -X POST http://localhost:5000/activate/simulate \
  -H "Content-Type: application/json" \
  -d '{"partner_id": "demo_id", "wallets": ["demo_wallet.eth"],
       "phrase": "Morals Before Metrics."}'
```

The response indicates `PASS` or `FAIL` and lists any failures.
## Partner SDK
A modular SDK is provided in `vaultfire_sdk/`. See `docs/partner_sdk.md` for activation steps and API usage. A login demo using ENS and Coinbase IDs lives in `frontend/pages/login_example.html`.
The Partner Port layer for third-party games is documented in `docs/partner_port_sdk.md`.


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

## Auto-Mirror Airdrop Engine
`engine/auto_mirror_airdrop.py` scans Farcaster, Lens, NS3 and Gitcoin for posts that echo Vaultfire belief phrases. Matching wallets automatically receive an ASM token reward, recorded in `logs/airdrop_log.json`.

Run the engine manually:

```bash
python3 engine/auto_mirror_airdrop.py
```


## Vaultfire Credits
`engine/vaultfire_credits.py` keeps a running total of credits for each ENS name
or Coinbase ID. Credits combine contributor XP with the number of verified
prompts a user submits. Balances are stored in `logs/vaultfire_credits.json`.

Check a contributor's balance:

```bash
python3 engine/vaultfire_credits.py ghostkey316
```

The onboarding API exposes `/vaultfire_credits/<id>` to query these totals.


## Design DNA
The project includes a short guide in `docs/design_culture.md` detailing the 90s-inspired look and our ethics-first approach to branding. It also covers simple UX principles and how to write human messages throughout the interface.

## Governance
The `engine/governance.py` module handles steward elections and proposal freezes. See `docs/governance.md` for details. It now exposes an emergency shutdown vote if stewards detect system abuse or partner corruption. Approved votes pause all partners and run a transparency audit.

## Soulprint Journal
Contributors may append immutable entries to `journals/<id>.json` using the
`engine.soul_journal` module. Each entry records a timestamp and text. The hash
of all entries forms a contributor's **soulprint**. Voters with an active
soulprint receive a weight bonus during steward elections.

## Health Sync Engine
`engine/health_sync_engine.py` optionally links wearable metrics or encrypted journal
entries to a contributor's profile. Data is stored locally using a user-supplied
key and grants small wellness point rewards.


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
- The Contributor Unlock Key NFT is a demo access mechanism on Base and does not provide production-grade security.
- Health-related features are informational only and do not replace professional medical advice.
- Biofeedback integrations do not store raw data and respect device permissions.
- Case study submissions are anonymized and stored publicly for research.
- Health sync data is locally encrypted with user keys and has not undergone security review.
- Modding modules are stored locally and not reviewed for security or content.
- Loyalty boosts from upvotes carry no monetary value.
- The SwapGate contract is a demo only and does not provide production-grade liquidity or bridging.
