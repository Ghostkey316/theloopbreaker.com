# RISC Zero Production Verifier

**Production-grade zero-knowledge proof verification for Vaultfire belief attestations.**

This directory contains the RISC Zero integration that replaces the development-mode `BeliefAttestationVerifier` with a production-ready, on-chain ZK proof system.

---

## Overview

The RISC Zero integration provides **cryptographically secure belief attestation** using zero-knowledge proofs. It enables Vaultfire to verify that users meet loyalty thresholds and protocol requirements without revealing private data.

### Key Components

1. **Guest Program** (`guest/`) — Rust program that runs inside the RISC Zero zkVM to validate attestations and produce ABI-encoded journals
2. **Host Program** (`host/`) — CLI tool for local proof generation (STARK or Groth16)
3. **Solidity Verifier** (`src/ProductionBeliefAttestationVerifier.sol`) — On-chain contract that verifies ZK proofs
4. **Boundless Integration** (`boundless-integration/`) — Host program for generating proofs via the Boundless marketplace
5. **Interfaces** (`interfaces/`) — Solidity interfaces for RISC Zero and backward compatibility
6. **Tests** (`test/`) — Foundry test suite for the verifier contract
7. **Deployment Scripts** (`script/`) — Foundry scripts for deploying and submitting proofs

---

## Architecture

### Off-Chain: Proof Generation

1. **User Input**: Attester provides belief message, loyalty score, and metadata
2. **Guest Program**: Validates input inside the zkVM (checks loyalty threshold, computes belief hash)
3. **Boundless Marketplace**: Generates a Groth16 SNARK proof (gas-efficient for on-chain verification)
4. **Output**: Seal (proof) and journal (public outputs)

### On-Chain: Proof Verification

1. **Proof Submission**: User submits seal and journal to `ProductionBeliefAttestationVerifier`
2. **Verification**: Contract calls the RISC Zero verifier router on Base mainnet
3. **Recording**: If valid, the attestation is recorded on-chain and an event is emitted

**Architecture Diagram**: See `docs/architecture.png`

---

## Technical Note: keccak256 vs sha256

**Important**: This verifier uses **sha256** for journal hashing, while the existing `BeliefAttestationVerifier` uses **keccak256**.

### Why the Change?

This is **not an arbitrary choice** — it's a **technical requirement of RISC Zero's proof system**:

- **RISC Zero's verifier** expects a `sha256` digest of the journal as part of the proof verification process
- The journal digest is computed as `sha256(journal_bytes)` and embedded in the RISC Zero receipt
- The on-chain verifier checks: `verify(seal, imageId, sha256(journal))`

### Compatibility

The `ProductionBeliefAttestationVerifier` implements the same `IStarkVerifier` interface as the development verifier, so it's a **drop-in replacement** for existing Vaultfire contracts. The hashing difference is internal to the proof system and doesn't affect the public API.

### Belief Hash Computation

- **Inside the guest program**: The belief hash is still computed as `keccak256(belief_message)` to match Solidity's standard
- **Journal verification**: Uses `sha256(journal_bytes)` as required by RISC Zero
- These are two separate operations serving different purposes in the proof system

---

## Setup

### Prerequisites

- **Rust** and Cargo (for guest program)
- **Foundry** (for Solidity contracts)
- **RISC Zero toolchain**: `cargo install cargo-risczero`

### Installation

```bash
# Install Foundry dependencies
cd risc0
forge install
```

---

## Usage

### 1. Build the Guest Program

Compile the RISC Zero guest program to get the **image ID** (required for deployment):

```bash
cd guest
cargo risczero build
```

**Output**: The image ID will be printed. Copy this value — you'll need it for contract deployment.

### 2. Deploy the Verifier Contract

Deploy to Base mainnet (or testnet):

```bash
cd risc0

# Set environment variables
export DEPLOYER_PRIVATE_KEY="your_private_key"
export IMAGE_ID="0x...image_id_from_step_1"
export BASE_RPC_URL="your_base_rpc_url"
export BASESCAN_API_KEY="your_basescan_api_key"

# Deploy
forge script script/Deploy.s.sol:DeployProductionVerifier \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify
```

**Output**: The deployed verifier address. Copy this for the next step.

### 3a. Generate a Proof Locally (Host Program)

Use the host program for local proof generation:

```bash
cd host
cargo build --release

# STARK proof (faster, for testing)
cargo run --release -- \
  --guest-elf ../guest/target/riscv-guest/riscv32im-risc0-zkvm-elf/release/vaultfire-belief-attestation-guest \
  --belief-message "I believe in decentralised identity and human agency" \
  --attester 0xf6A677de83C407875C9A9115Cf100F121f9c4816 \
  --epoch 1 \
  --module-id 1 \
  --loyalty-score 9000

# Groth16 proof (slower, for on-chain verification)
cargo run --release -- \
  --guest-elf ../guest/target/riscv-guest/riscv32im-risc0-zkvm-elf/release/vaultfire-belief-attestation-guest \
  --belief-message "I believe in decentralised identity and human agency" \
  --attester 0xf6A677de83C407875C9A9115Cf100F121f9c4816 \
  --epoch 1 \
  --module-id 1 \
  --loyalty-score 9000 \
  --groth16 \
  --output-dir ./proof_output
```

**Output files**: `proof_seal.hex`, `proof_journal.hex`, `image_id.hex`, `journal_digest.hex`

### 3b. Generate a Proof via Boundless (Production)

For production use, submit proofs to the Boundless decentralised proving marketplace:

```bash
cd boundless-integration

# Set environment variables
export RPC_URL="$BASE_RPC_URL"
export PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"
export PINATA_JWT="your_pinata_jwt"  # Optional

# Generate proof
cargo run --release -- \
  --belief-message "I believe in decentralized science." \
  --attester "0x...your_address" \
  --loyalty-score 9500
```

**Output**: `proof_seal.hex` and `proof_journal.hex` files containing the proof data.

### 4. Submit the Proof On-Chain

Submit the generated proof to the verifier:

```bash
cd risc0

# Set environment variables
export VERIFIER_ADDRESS="0x...deployed_verifier_address"
export PROOF_SEAL_HEX=$(cat ../boundless-integration/proof_seal.hex)
export PROOF_JOURNAL_HEX=$(cat ../boundless-integration/proof_journal.hex)

# Submit proof
forge script script/SubmitProof.s.sol:SubmitProof \
  --rpc-url $BASE_RPC_URL \
  --broadcast
```

**Output**: Confirmation that the attestation was verified and recorded on-chain.

---

## Testing

Run the Foundry test suite:

```bash
cd risc0
forge test -vv
```

The tests use a mock RISC Zero verifier to simulate success and failure cases without requiring real proof generation.

---

## Integration with Existing Vaultfire Contracts

The `ProductionBeliefAttestationVerifier` implements the `IStarkVerifier` interface, making it compatible with existing contracts like `DilithiumAttestor`.

To integrate:

1. Deploy the `ProductionBeliefAttestationVerifier` (see above)
2. Update the verifier address in contracts that reference the old `BeliefAttestationVerifier`
3. The new verifier provides the same `verifyProof(bytes, uint256[])` interface

**New contracts** should use the more efficient `verifyAttestation(bytes seal, bytes journal)` function directly.

---

## Security Considerations

### Auditing

- The guest program logic should be audited to ensure correct validation of loyalty thresholds
- The Solidity verifier should be audited for correct interaction with the RISC Zero verifier router
- The image ID must be kept up-to-date when the guest program is modified

### Image ID Management

The **image ID** is the cryptographic hash of the guest program. It ensures that only proofs from the correct program are accepted.

- The `ProductionBeliefAttestationVerifier` includes a **48-hour timelock** for image ID changes:
  1. `proposeImageIdChange(newImageId)` — Starts the timelock
  2. Wait 48 hours
  3. `executeImageIdChange()` — Applies the new image ID
  4. `cancelImageIdChange()` — Cancel if needed
- This prevents malicious instant changes and gives stakeholders time to review
- Always verify the new image ID matches the recompiled guest program before updating

### RISC Zero Verifier Address

The RISC Zero verifier router on Base mainnet is at:
```
0x0b144e07a0826182b6b59788c34b32bfa86fb711
```

This address is hardcoded in the deployment script. Verify it matches the official RISC Zero deployment before using.

### Ownership

The `ProductionBeliefAttestationVerifier` is owned by the `MultisigGovernance` contract at `0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D`. All privileged operations (image ID changes, ownership transfers) must go through the multisig governance flow.

## Deployed Contracts

| Contract | Address | Network |
|----------|---------|--------|
| ProductionBeliefAttestationVerifier | `0xBDB5d85B3a84C773113779be89A166Ed515A7fE2` | Base Mainnet |
| MultisigGovernance | `0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D` | Base Mainnet |
| RISC Zero Verifier Router | `0x0b144e07a0826182b6b59788c34b32bfa86fb711` | Base Mainnet |

---

## References

- [RISC Zero Developer Docs](https://dev.risczero.com/)
- [Boundless Documentation](https://docs.boundless.network/)
- [RISC Zero Verifier Contracts](https://dev.risczero.com/api/blockchain-integration/contracts/verifier)
- [Vaultfire Protocol](https://github.com/Ghostkey316/ghostkey-316-vaultfire-init)

---

## License

MIT License — See the root LICENSE file for details.
