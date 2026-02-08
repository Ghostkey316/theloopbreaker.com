# Demo: Vaultfire x402 on Base + ASM/NS3 partner receipts

This demo is designed to show partners (Assemble AI + Base) the core Vaultfire value proposition:

- **Base is home base** (EVM settlement / identity anchor)
- **ASM is first-class** in x402 rules (not treated as ETH)
- Partners can integrate in minutes using a **signed receipt** (no KYC, no identity metadata)
- Vaultfire produces an **append-only ledger** of billable events + unlocks

## What this demo shows

1) Vaultfire declares an x402 endpoint priced in **ASM**.
2) A partner (Assemble/NS3) submits a **signed receipt** to the Vaultfire webhook.
3) Vaultfire verifies signature + anti-replay and records a billable ledger entry.

---

## Prereqs

- Node >= 18
- Python (for the Flask listener app if you run it locally)

## Step 0: Configure partner keys (no secrets committed)

Set one env var (recommended):

```bash
export VAULTFIRE_X402_PARTNER_KEYS_JSON='{"assemble":{"k1":"dev-secret"},"ns3":{"k1":"dev-secret"}}'
```

Windows PowerShell:

```powershell
$env:VAULTFIRE_X402_PARTNER_KEYS_JSON='{"assemble":{"k1":"dev-secret"},"ns3":{"k1":"dev-secret"}}'
```

## Step 1: Start Vaultfire x402 listener

Run your Vaultfire server/app that registers `x402EventListener`.

The webhook endpoint is:
- `POST /vaultfire/x402-webhook`

Sanity check:
- `GET /vaultfire/x402-webhook` should return `{ "status": "listening", ... }`

## Step 2: Submit an ASM receipt (partner-side)

Run the Node example:

```bash
node scripts/x402_partner_webhook_example.js \
  --url http://localhost:5000/vaultfire/x402-webhook \
  --rail assemble \
  --secret "dev-secret" \
  --wallet bpow20.cb.id \
  --amount 0.00021 \
  --currency ASM \
  --txref asm_receipt_demo_001
```

Expected result:
- HTTP 200 with a JSON response containing `entry`.

## Step 3: Verify ledger output

Vaultfire writes an append-only entry to the x402 ledger path (default):
- `logs/x402_ledger.jsonl`

You should see an entry with:
- `event: "webhook"`
- `currency: "ASM"`
- `metadata.rail: "assemble"`
- `metadata.partner_id: "assemble"`
- `metadata.key_id: "k1"`

---

## Why this matters (partner framing)

- **No KYC**: wallet-only, mission-aligned.
- **No surveillance**: the receipt proves payment/authorization without collecting identity metadata.
- **Interop**: Base can remain the anchor chain; ASM/NS3 can be an economic rail for agents.
- **Upgradeable security posture**: the fast-path uses HMAC + nonce/timestamp; it can graduate to public-key receipts.
