# Demo runner (PowerShell): Vaultfire x402 + ASM receipt
#
# Assumes your Vaultfire Flask/HTTP app is already running and exposing:
#   http://localhost:5000/vaultfire/x402-webhook

$ErrorActionPreference = 'Stop'

$env:VAULTFIRE_X402_PARTNER_KEYS_JSON='{"assemble":{"k1":"dev-secret"},"ns3":{"k1":"dev-secret"}}'

Write-Host "[1/2] Health check" -ForegroundColor Cyan
try {
  $resp = Invoke-RestMethod -Method GET -Uri "http://localhost:5000/vaultfire/x402-webhook"
  $resp | ConvertTo-Json -Depth 10
} catch {
  Write-Host "Health check failed. Is your Vaultfire server running on :5000?" -ForegroundColor Red
  throw
}

Write-Host "[2/2] Submit signed ASM receipt" -ForegroundColor Cyan
node scripts/x402_partner_webhook_example.js `
  --url http://localhost:5000/vaultfire/x402-webhook `
  --rail assemble `
  --secret "dev-secret" `
  --wallet bpow20.cb.id `
  --amount 0.00021 `
  --currency ASM `
  --txref asm_receipt_demo_001

Write-Host "Done. Check logs/x402_ledger.jsonl" -ForegroundColor Green
