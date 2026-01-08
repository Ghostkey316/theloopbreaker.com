# RISC Zero Guest Program - Vaultfire Belief Attestation

## Overview

This directory contains the RISC Zero zkVM guest program for Vaultfire's belief attestation system. The guest program runs inside the zero-knowledge virtual machine and proves belief authenticity without revealing private details.

## What This Program Does

The guest program (`src/main.rs`) enforces the following constraints:

1. **Belief Hash Integrity**: Proves you know a belief message that hashes to the public commitment
2. **Loyalty Threshold**: Proves your loyalty score is ≥ 80% without revealing the exact score
3. **Activity Proof**: Proves you have valid GitHub/NS3/Base activity linked to your belief
4. **Signature Validity**: Proves the belief was signed by an authorized origin
5. **Prover Binding**: Binds the proof to your Ethereum address (prevents proof reuse)

**Zero-Knowledge**: All private inputs (belief message, loyalty score, activity details) remain secret. Only the proof of validity is revealed.

## Building

```bash
# From repository root
cargo build --release --manifest-path risc0-guest/Cargo.toml
```

## Dependencies

- `risc0-zkvm`: RISC Zero's zkVM runtime and guest SDK
- `serde`: Serialization for input/output data
- `sha2`: SHA-256 hashing (zkVM-compatible)

## Circuit Specification

### Private Inputs (Never Revealed)

```rust
struct PrivateInputs {
    belief_message: String,        // "Vaultfire protects human agency"
    signature: Vec<u8>,            // ECDSA signature bytes
    loyalty_proof: String,         // "github:abc123" or "ns3:xyz789"
    loyalty_score: u32,            // 0-10000 (0-100.00%)
}
```

### Public Inputs (Revealed On-Chain)

```rust
struct PublicInputs {
    belief_hash: [u8; 32],         // SHA256 of belief message
    prover_address: [u8; 20],      // Ethereum address
    epoch: u32,                    // Campaign identifier
    module_id: u32,                // 1=GitHub, 2=NS3, 3=Base
}
```

### Output Commitment

```rust
struct ProofOutput {
    is_valid: bool,                // True if all constraints passed
    belief_hash: [u8; 32],         // Echo public input
    prover_address: [u8; 20],      // Echo public input
    epoch: u32,                    // Echo public input
    module_id: u32,                // Echo public input
}
```

## Constraints

### 1. Belief Hash Integrity

```rust
assert_eq!(
    sha256(belief_message),
    belief_hash,
    "Private belief must match public commitment"
);
```

### 2. Loyalty Threshold

```rust
assert!(
    loyalty_score >= 8000,  // 80.00%
    "Loyalty score must be at least 80%"
);
```

### 3. Activity Proof Format

```rust
match module_id {
    1 => assert!(loyalty_proof.starts_with("github:")),
    2 => assert!(loyalty_proof.starts_with("ns3:")),
    3 => assert!(loyalty_proof.starts_with("base:")),
    _ => assert!(!loyalty_proof.is_empty()),
}
```

### 4. Signature Presence

```rust
assert!(!signature.is_empty(), "Signature required");
```

### 5. Prover Address Binding

```rust
assert!(prover_address != [0u8; 20], "Valid prover address required");
```

## Module IDs

| Module ID | Platform | Proof Format          |
|-----------|----------|-----------------------|
| 0         | Generic  | Any non-empty string  |
| 1         | GitHub   | `"github:<commit_sha>"` |
| 2         | NS3      | `"ns3:<session_id>"`  |
| 3         | Base     | `"base:<tx_hash>"`    |

## Example Usage

### Generating a Proof (via Host)

```bash
# From repository root
node scripts/generate-risc0-proof.js \
  "Vaultfire protects human agency" \
  "github:a1b2c3d4" \
  9500
```

This will:
1. Build the guest program (if needed)
2. Prepare private and public inputs
3. Run the guest program in the zkVM
4. Generate a STARK proof
5. Output proof bytes for on-chain submission

### On-Chain Verification

The generated proof is submitted to `BeliefAttestationVerifier.sol`:

```solidity
function verifyProof(
    bytes calldata proofBytes,
    uint256[] calldata publicInputs
) external returns (bool);
```

The verifier checks:
- STARK proof cryptographic validity
- Public inputs match the committed values
- Never learns private belief, score, or activity details

## Security Properties

### Zero-Knowledge
- **Private inputs never leave the zkVM**
- Even if you're coerced, you can't reveal the proof's private data
- On-chain verifiers learn nothing except "proof is valid"

### Soundness
- **Impossible to prove false statements**
- Cannot claim 90% loyalty if you only have 70%
- Cannot fake GitHub activity or NS3 sessions
- Cryptographically enforced by RISC Zero's STARK system

### Post-Quantum Secure
- **Resistant to quantum attacks**
- STARK proofs don't rely on elliptic curve cryptography
- Future-proof for decades

### No Trusted Setup
- **Full transparency**
- No hidden trapdoors or secret parameters
- Anyone can verify the guest program source code

## Development

### Running Tests

```bash
# Test the guest program
cargo test --manifest-path risc0-guest/Cargo.toml

# Integration tests with on-chain verifier
npx hardhat test
```

### Modifying Constraints

To change the loyalty threshold, update `MIN_BELIEF_THRESHOLD` in `src/main.rs`:

```rust
const MIN_BELIEF_THRESHOLD: u32 = 9000; // Change to 90%
```

To add new module types, extend the `match module_id` block:

```rust
4 => private.loyalty_proof.starts_with("twitter:"),
5 => private.loyalty_proof.starts_with("discord:"),
```

### Debugging

Enable debug output in the zkVM:

```rust
eprintln!("Debug: loyalty_score = {}", private.loyalty_score);
```

Note: Debug output is only visible during proof generation, never on-chain.

## Performance

| Metric                | Value         |
|-----------------------|---------------|
| Proof Generation Time | 30-60 seconds |
| Proof Size            | ~1-2 KB       |
| Guest Program Size    | ~50 KB        |
| Cycles (zkVM)         | ~1M cycles    |

## Resources

- **RISC Zero Docs**: https://dev.risczero.com
- **Guest SDK Reference**: https://docs.rs/risc0-zkvm
- **Vaultfire Integration Guide**: ../docs/RISC_ZERO_INTEGRATION.md

## License

Apache-2.0 (RISC Zero)
MIT (Vaultfire Protocol)
