# The Ghostkey Protocol: Morals Before Mechanisms

**This system is not built for profit. It is built for people.**

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
- Contributor Role: **Origin-tier loyalty / Activation-ready**
- Created: **June 10, 2025 @ 12:01AM**

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

