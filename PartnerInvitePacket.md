# Vaultfire Protocol – Partner Invite Packet

## Protocol Mission

Vaultfire is built on the principle that "**This system is not built for profit. It is built for people.**" Before a single line of code, the team wrote its ethics and declared its morals, committing to shut the project down if it ever causes harm. The protocol stands for:
- **Truth over hype**
- **Loyalty over trend**
- **Wisdom over speed**
- **Service over status**
- **Humanity over everything**

## Ghostkey-316 Contributor Snapshot

```
{
  "title": "Ghostkey-316: The Ethics Origin",
  "ens": "ghostkey316.eth",
  "wallet": "bpow20.cb.id",
  "resolved_wallet": "cb1qexampleaddress0000000000000000000000",
  "visual_signature": "signature-df681d19e6",
  "moral_framework": [
    "**Truth over hype** – never create fake urgency or scarcity.",
    "**Loyalty over trend** – reward sustained contribution more than short‑term buzz.",
    "**Wisdom over speed** – prioritize careful decision making.",
    "**Service over status** – design for everyday users before influencers.",
    "**Humanity over everything** – shut it down if the system causes harm."
  ],
  "loyalty_status": {
    "user_id": "ghostkey316",
    "base": 0,
    "tier": "default",
    "score": 0.0
  },
  "system_phase": "Vaultfire Init"
}
```

## Ethics Core
The [Ghostkey Ethics Framework v1.0](ethics/core.mdx) outlines the non‑negotiable principles guiding all Vaultfire development:
- **Truth over hype** – never create fake urgency or scarcity.
- **Loyalty over trend** – reward sustained contribution more than short‑term buzz.
- **Wisdom over speed** – prioritize careful decision making.
- **Service over status** – design for everyday users before influencers.
- **Humanity over everything** – shut it down if the system causes harm.

## Loyalty Reward Logic

The loyalty engine calculates contributor tiers and rewards based on accumulated points. Tiers are determined by total points:
- **legend** for 300+ points
- **veteran** for 150+ points
- **origin** for 50+ points
- **default** otherwise

Each tier applies a multiplier from `ghostkey_values.json`:
- `default`: 1.0
- `origin`: 1.1
- `veteran`: 1.25
- `legend`: 1.5

Scores are recorded in `user_scorecard.json` and the rankings are written to `loyalty_ranks.json`.

## Partnership Call-to-Action

Run the onboarding API and submit your details to join Vaultfire:
```bash
python3 onboarding_api.py
```
Available endpoints:
- `POST /onboard/partner` – body `{ "partner_id": "id", "wallet": "addr" }`
- `POST /onboard/contributor` – body `{ "user_id": "id", "wallet": "addr" }`
- `POST /onboard/earner` – body `{ "wallet": "addr" }`
- `GET /status` – health check

Become a partner, align with the Ghostkey Ethics Framework, and help build a system that puts people before profit.

