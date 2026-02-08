// Example: generate a signed x402 receipt (HMAC) and POST it to Vaultfire.
//
// Usage:
//   node scripts/x402_partner_webhook_example.js \
//     --url http://localhost:5000/vaultfire/x402-webhook \
//     --rail assemble \
//     --secret "dev-secret" \
//     --wallet bpow20.cb.id \
//     --amount 0.00021 \
//     --currency ASM \
//     --txref asm_receipt_123
//
// Notes:
// - Canonical JSON includes only: rail,currency,amount,wallet_address,tx_ref,nonce,timestamp
// - Signature is hex(HMAC_SHA256(secret, canonical_json))

const crypto = require('crypto');

function arg(name, def = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith('--')) return def;
  return v;
}

function canonicalReceipt(payload) {
  const msg = {
    partner_id: payload.partner_id,
    key_id: payload.key_id,
    rail: payload.rail,
    currency: String(payload.currency || '').toUpperCase(),
    amount: payload.amount,
    wallet_address: payload.wallet_address,
    tx_ref: payload.tx_ref,
    nonce: payload.nonce,
    timestamp: payload.timestamp,
  };
  // sorted keys, compact separators
  const keys = Object.keys(msg).sort();
  const sorted = {};
  for (const k of keys) sorted[k] = msg[k];
  return JSON.stringify(sorted);
}

function hmacHex(secret, message) {
  return crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex');
}

async function main() {
  const url = arg('url', 'http://localhost:5000/vaultfire/x402-webhook');
  const rail = arg('rail', 'assemble');
  const secret = arg('secret');
  const wallet = arg('wallet', 'bpow20.cb.id');
  const amount = Number(arg('amount', '0.00021'));
  const currency = arg('currency', 'ASM');
  const txref = arg('txref', `demo_${Date.now()}`);

  if (!secret) {
    console.error('Missing --secret');
    process.exit(1);
  }

  const payload = {
    partner_id: rail, // simplest: use rail name as partner_id (e.g., "assemble")
    key_id: 'k1',
    rail,
    event_type: 'payment',
    status: 'received',
    currency,
    amount,
    wallet_address: wallet,
    tx_ref: txref,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const message = canonicalReceipt(payload);
  payload.signature = hmacHex(secret, message);

  console.log('Canonical JSON:', message);
  console.log('Signature:', payload.signature);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log('HTTP', res.status);
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
