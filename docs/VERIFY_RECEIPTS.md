# Vaultfire Verify Receipts

This repo supports **verification receipts**: machine-readable artifacts that record what you ran locally (preflight + tests) and optionally attach a cryptographic signature.

## Files

A verify run can produce:

- `artifacts/verify-receipt.json` — the receipt payload (machine-readable)
- `artifacts/verify-receipt.sha256` — SHA256 of the receipt payload (tamper-evident)
- `artifacts/verify-receipt.sig` — OpenSSH signature over `verify-receipt.json` (optional)
- `artifacts/verify-receipt.allowed_signers` — OpenSSH allowed-signers file for verification (optional)

## What it proves (and what it does not)

### Proves

If you run `npm run verify` (or `npm run verify:signed`) and share the artifacts:

- The repo was at a specific git commit at the time of the run.
- The caller’s Node runtime/platform were recorded.
- `npm run preflight` and `npm test` exited successfully (if the command itself exited 0).
- The receipt file you are looking at was not modified after the receipt hash was computed.
- If signed: the receipt file was signed by the holder of the signing key corresponding to the included public key.

### Does not prove

- That the machine running the verification was malware-free.
- That dependencies installed were identical across machines (unless you also compare lockfiles and environment).
- That the signer identity string corresponds to a real-world identity (unless you bind it externally, e.g., via GitHub SSH keys).
- That the project is production-secure or audited.

## Receipt schema (v2)

Top-level fields:

- `kind`: `vaultfire.verify.receipt`
- `version`: `2`
- `createdAtUtc`: ISO timestamp
- `repo`:
  - `path`: repo path (may be redacted)
  - `git.commit`: commit hash
  - `git.branch`: current branch
  - `git.status`: short status summary (may be omitted)
  - `git.remote`: `git remote -v` output (may be omitted)
- `runtime`: Node version + platform + arch
- `inputs`: SHA256 + size of selected files:
  - `package.json`
  - `package-lock.json`
  - `README.md`
- `receiptSha256`: SHA256 of the canonical JSON string
- `signature` (present only when signing succeeds):
  - `scheme`: `ssh-keygen -Y sign`
  - `namespace`: signature namespace
  - `identity`: signer identity string
  - `publicKey`: signer public key (OpenSSH format)
  - `sigPath`: relative path to `.sig`
  - `allowedSignersPath`: relative path to `allowed_signers`

## Commands

- `npm run verify` — preflight + tests + receipt; signs if a key is available.
- `npm run verify:signed` — preflight + tests + receipt; **requires** signing.
- `npm run verify:receipt` — write receipt (no signing).
- `npm run verify:receipt:sign` — write receipt; sign if a key is available.
- `npm run verify:receipt:signed` — write receipt; **requires** signing.
- `npm run verify:check -- --receipt <path> --sig <path> --allowed <path> --identity <id>` — verify a signed receipt.

## Privacy controls

By default, the receipt may include local paths and git remote output.

Use flags to reduce disclosure:

- `--redact-paths` — replaces `repo.path` with `<redacted>`
- `--no-remote` — omits `repo.git.remote`
- `--no-status` — omits `repo.git.status`

Example:

```bash
node tools/verify_receipt.js --sign=auto --redact-paths --no-remote --no-status
```

## Threat model note (short)

The receipt is meant to support **coordination and auditing**. It is strongest when:

- the signer’s public key is bound to an identity out-of-band (e.g., a GitHub account’s SSH keys), and
- verification is performed on a different machine/person than the signer.

Do not treat the receipt as a substitute for an external security review.
