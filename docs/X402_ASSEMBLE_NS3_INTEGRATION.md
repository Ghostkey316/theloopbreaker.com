# x402 + Assemble AI (ASM) + NS3 integration (Vaultfire)

Goal: make it trivial for **Assemble AI** to plug into Vaultfire using x402-style payment gating while preserving Vaultfire’s mission:
- Privacy over surveillance
- Wallet-only (no KYC)
- No identity metadata leakage

## What x402 is in Vaultfire

Vaultfire’s x402 layer is:
1) endpoint monetization rules (what costs what)
2) HTTP 402 semantics ("payment required")
3) append-only ledgering of paid access (auditable, scrubbed)

It is intentionally rail-agnostic.

Key files:
- `vaultfire/x402_gateway.py` (rules + ledger)
- `vaultfire/x402_listener.py` (webhook + dashboard)
- `Vaultfire/x402_rails.py` (rail adapters; EVM/Assemble/NS3)

## Currency support

Vaultfire supports multiple currencies at the rule level.
Out of the box, some rules are denominated in **ASM** (Assemble AI).

## Partner plug-in pattern (recommended)

## Quick-start examples

Node example:
- `node scripts/x402_partner_webhook_example.js --url http://localhost:5000/vaultfire/x402-webhook --rail assemble --secret "dev-secret" --wallet bpow20.cb.id --amount 0.00021 --currency ASM --txref asm_receipt_123`

Python example:
- `python scripts/x402_partner_webhook_example.py --url http://localhost:5000/vaultfire/x402-webhook --rail ns3 --secret dev-secret --wallet bpow20.cb.id --amount 0.00021 --currency ASM --txref ns3_session_123`

### 1) Assemble/NS3 emits a signed receipt (HMAC fast-path)
For fastest integration, Vaultfire supports **shared-secret HMAC** receipts.

Payload fields:
- `partner_id`: issuer id (e.g., `"assemble"` or your org name)
- `key_id`: key identifier for rotation (e.g., `"k1"`)
- `rail`: `"assemble"` or `"ns3"`
- `currency`: `"ASM"` (or `ETH`/`USDC` when applicable)
- `amount`: numeric
- `wallet_address`: payer wallet handle (can be an Assemble/NS3 wallet id)
- `tx_ref`: unique payment/session reference (or `tx_hash`/`session_id`)
- `timestamp`: unix seconds
- `nonce`: unique random string (replay-protected)
- `signature`: hex(HMAC_SHA256(secret, canonical_json))

Canonical JSON is computed over only:
`partner_id,key_id,rail,currency,amount,wallet_address,tx_ref,nonce,timestamp` with sorted keys + compact separators.

Vaultfire expects partner keys via env (preferred):
- `VAULTFIRE_X402_PARTNER_KEYS_JSON` (JSON map: partner_id -> key_id -> secret)
- OR `VAULTFIRE_X402_PARTNER_KEYS_PATH` (path to that JSON)

Backward-compat fallback (single secret per rail):
- `VAULTFIRE_X402_ASSEMBLE_SECRET`
- `VAULTFIRE_X402_NS3_SECRET`

### 2) Vaultfire ingests via webhook
POST to:
- `/vaultfire/x402-webhook`

Example payload:
```json
{
  "rail": "assemble",
  "event_type": "payment",
  "status": "received",
  "currency": "ASM",
  "amount": 0.00021,
  "wallet_address": "bpow20.cb.id",
  "tx_ref": "asm_receipt_123",
  "signature": "assemble::signed-receipt"
}
```

Vaultfire will:
- scrub identity metadata
- verify wallet signal requirements (ghostkey-mode rules)
- write an append-only ledger entry

## Security notes (what to harden next)

To make this production-grade for third-party rails:
- Add explicit receipt signature verification for `rail=assemble|ns3`.
- Add replay protection: nonce + expiry windows per receipt.
- Add rate limiting for repeated 402 denials.

## Why this is good for Assemble AI

- Vaultfire does not demand identity collection.
- ASM is treated as a first-class currency.
- NS3 and Assemble can integrate through a simple signed receipt -> webhook pattern.
- The resulting ledger is auditable without becoming a panopticon.
