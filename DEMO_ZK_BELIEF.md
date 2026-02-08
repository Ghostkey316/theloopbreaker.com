# DEMO_ZK_BELIEF.md

This repo includes an end-to-end wiring path for a **real RISC Zero proof** whose **journal bytes** are committed in a way that matches the on-chain verifier’s binding:

```solidity
keccak256(abi.encode(beliefHash, proverAddress, epoch, moduleID))
```

## What was wired

- **Guest programs** now:
  - compute `beliefHash = keccak256(utf8(belief_message))`
  - commit **ABI-encoded journal bytes** equal to `abi.encode(bytes32,address,uint256,uint256)` (128 bytes)

- **Rust host prover** now:
  - computes the same `beliefHash` using Keccak-256
  - expects the guest’s journal to be 128 bytes and prints the decoded fields

- **JS proof generation script** now:
  - calls the **real Rust prover** (`cargo run ... vaultfire-prover prove ...`)
  - returns `proofBytes` (hex), `publicInputs` (uint256[]), and `journalDigest`

- **Hardhat test**:
  - deploys `BeliefAttestationVerifierProduction` with a `MockRiscZeroVerifier`
  - asserts the verifier’s computed `journalDigest` matches the expected digest for the public inputs

## Demo: generate a proof

Prereqs:
- Rust toolchain installed (`cargo` on PATH)
- Node deps installed (`npm i`)

Run:

```bash
node scripts/generate-risc0-proof.js "Vaultfire protects human agency" "github:abc123" 9500
```

This will:
1. Create a temp input JSON for the Rust prover.
2. Run the prover:
   - `cargo run --release --manifest-path risc0-prover/host/Cargo.toml -- prove --input ... --output ...`
3. Print Solidity-friendly output:
   - `proofBytes` (bytes)
   - `publicInputs` (uint256[4])
   - `journalDigest` (bytes32)

## Demo: run the binding test

```bash
npx hardhat test test/Risc0BeliefAttestationProduction.test.js
```

The mock verifier checks that `imageId` and `journalDigest` match what it expects.

## Notes / gotchas

- The Solidity verifier verifies **journalDigest**, not the plaintext journal. The digest must bind to:
  `beliefHash`, `proverAddress`, `epoch`, `moduleID`.
- The guest commits the **ABI bytes** so that the contract’s `keccak256(abi.encode(...))` is consistent.
- This repo’s proof byte format is produced by `risc0-prover/host` (seal length + seal + journal length + journal). For mainnet, ensure the proof format matches the verifier contract you deploy.
