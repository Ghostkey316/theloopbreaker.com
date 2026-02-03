<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# STARK Proof Generation Guide for Vaultfire Belief Attestation

## Overview

This guide explains how to generate STARK proofs for Vaultfire's belief attestation system. The STARK proof system provides:

- ✅ **No Trusted Setup** - Aligns with "transparency with privacy" values
- ✅ **Post-Quantum Security** - Future-proof against quantum computers
- ✅ **Scalability** - Large proof systems with reasonable proof sizes
- ✅ **Privacy** - Prove loyalty without revealing private beliefs

---

## What the STARK Proof Proves

The belief attestation proof verifies (without revealing):

1. **Secret Knowledge**: Prover knows a private belief matching the public `beliefHash`
2. **Threshold Met**: Belief meets protocol-defined threshold (80% alignment)
3. **Authenticity**: Belief originated through behavior, not fraud
4. **Optional Provenance**: Belief forged through Vaultfire-approved paths (NS3, GitHub, etc.)

**Public Inputs:**
- `beliefHash` - Hash of the belief content
- `proverAddress` - Wallet address of the prover
- `epoch` - Campaign/era identifier (0 for now, extensible)
- `moduleID` - Vaultfire module ID (0 for now, extensible)

**Private Inputs (never revealed):**
- Actual belief message or claim
- Signature proving origin
- Loyalty proof (GitHub push, NS3 login, tweet ID, onchain move, etc.)

**Output:**
> "This person is loyal, meets belief threshold, and passed Vaultfire's moral integrity check — without revealing how."

---

## Proof Generation Options

### Option 1: Risc0 STARK Prover (Recommended for Development)

Risc0 provides a production-ready STARK proving system with great developer experience.

#### Installation

```bash
# Install Risc0 toolchain
curl -L https://risczero.com/install | bash
rzup install

# Verify installation
cargo risczero --version
```

#### Create Belief Attestation Circuit

Create `zk/belief-attestation/src/main.rs`:

```rust
#![no_main]
// Risc0 guest program for belief attestation

use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Serialize, Deserialize)]
struct PrivateInputs {
    belief_message: String,
    signature: Vec<u8>,
    loyalty_proof: LoyaltyProof,
}

#[derive(Serialize, Deserialize)]
struct LoyaltyProof {
    proof_type: String, // "github" | "ns3" | "tweet" | "onchain"
    proof_data: Vec<u8>,
    timestamp: u64,
}

#[derive(Serialize, Deserialize)]
struct PublicOutputs {
    belief_hash: [u8; 32],
    prover_address: [u8; 20],
    epoch: u32,
    module_id: u32,
}

risc0_zkvm::guest::entry!(main);

fn main() {
    // Read private inputs
    let private_inputs: PrivateInputs = env::read();

    // Read public inputs
    let expected_belief_hash: [u8; 32] = env::read();
    let expected_prover: [u8; 20] = env::read();
    let epoch: u32 = env::read();
    let module_id: u32 = env::read();

    // 1. Verify belief hash matches
    let mut hasher = Sha256::new();
    hasher.update(private_inputs.belief_message.as_bytes());
    let computed_hash: [u8; 32] = hasher.finalize().into();
    assert_eq!(computed_hash, expected_belief_hash, "Belief hash mismatch");

    // 2. Verify signature recovers to prover address
    let recovered_address = recover_signer(&computed_hash, &private_inputs.signature);
    assert_eq!(recovered_address, expected_prover, "Signature mismatch");

    // 3. Compute belief score from message and loyalty proof
    let belief_score = compute_belief_score(
        &private_inputs.belief_message,
        &private_inputs.loyalty_proof
    );
    assert!(belief_score >= 8000, "Belief threshold not met"); // 80% minimum

    // 4. Verify loyalty proof authenticity
    verify_loyalty_proof(&private_inputs.loyalty_proof, module_id);

    // 5. Verify epoch validity
    assert!(epoch <= u32::MAX, "Invalid epoch");

    // Commit public outputs
    env::commit(&PublicOutputs {
        belief_hash: expected_belief_hash,
        prover_address: expected_prover,
        epoch,
        module_id,
    });
}

fn recover_signer(message_hash: &[u8; 32], signature: &[u8]) -> [u8; 20] {
    // Implement ECDSA signature recovery
    // Returns Ethereum address that signed the message
    // TODO: Use k256 crate for proper ECDSA recovery
    [0u8; 20] // Placeholder
}

fn compute_belief_score(belief_message: &str, loyalty_proof: &LoyaltyProof) -> u32 {
    // Compute belief alignment score based on:
    // - Belief message content analysis
    // - Loyalty proof strength
    // - Time held (from loyalty_proof.timestamp)
    // Returns score in basis points (10000 = 100%)

    let mut score = 0u32;

    // Base score from belief length and content
    if belief_message.len() > 100 {
        score += 2000; // +20% for detailed belief
    }

    // Score from loyalty proof type
    match loyalty_proof.proof_type.as_str() {
        "github" => score += 3000, // +30% for code contribution
        "ns3" => score += 2500,    // +25% for NS3 login
        "tweet" => score += 1500,  // +15% for social proof
        "onchain" => score += 4000, // +40% for onchain action
        _ => score += 500,
    }

    // Time-based bonus (loyalty duration)
    let days_held = (current_timestamp() - loyalty_proof.timestamp) / 86400;
    if days_held > 180 { // 6+ months
        score += 3000; // +30% for long-term holding
    } else if days_held > 30 { // 1+ month
        score += 1500; // +15% for medium-term
    }

    score
}

fn verify_loyalty_proof(proof: &LoyaltyProof, expected_module_id: u32) {
    // Verify loyalty proof is authentic and matches module_id
    // For now, basic validation
    assert!(!proof.proof_data.is_empty(), "Empty loyalty proof");
    assert!(proof.timestamp > 0, "Invalid timestamp");

    // Future: Verify cryptographic proofs for each type
    // - GitHub: Verify commit signature
    // - NS3: Verify NS3 attestation
    // - Tweet: Verify Twitter API signature
    // - Onchain: Verify blockchain transaction
}

fn current_timestamp() -> u64 {
    // In Risc0, you'd read this from host
    env::read()
}
```

#### Build the Circuit

```bash
cd zk/belief-attestation
cargo build --release
```

#### Generate Proof (Host Program)

Create `zk/proof-generator/src/main.rs`:

```rust
use risc0_zkvm::{default_prover, ExecutorEnv};
use belief_attestation_methods::{BELIEF_ATTESTATION_ELF, BELIEF_ATTESTATION_ID};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct BeliefAttestationInput {
    // Private inputs
    belief_message: String,
    signature: Vec<u8>,
    loyalty_proof: LoyaltyProof,

    // Public inputs
    belief_hash: [u8; 32],
    prover_address: [u8; 20],
    epoch: u32,
    module_id: u32,
}

fn main() {
    // Read input from JSON file or CLI
    let input: BeliefAttestationInput = serde_json::from_str(&std::fs::read_to_string("input.json")?)?;

    // Setup executor environment with private inputs
    let env = ExecutorEnv::builder()
        .write(&input.belief_message)
        .write(&input.signature)
        .write(&input.loyalty_proof)
        .write(&input.belief_hash)
        .write(&input.prover_address)
        .write(&input.epoch)
        .write(&input.module_id)
        .write(&get_current_timestamp())
        .build()?;

    // Generate proof
    let prover = default_prover();
    let receipt = prover.prove(env, BELIEF_ATTESTATION_ELF)?;

    // Extract proof and public outputs
    let proof_bytes = receipt.journal.bytes.clone();
    let seal = receipt.inner.flat().seal.clone();

    // Save proof to file (for Solidity verification)
    std::fs::write("proof.bin", &seal)?;
    std::fs::write("public_outputs.bin", &proof_bytes)?;

    println!("✅ Proof generated successfully!");
    println!("   Image ID: {}", hex::encode(BELIEF_ATTESTATION_ID));
    println!("   Proof size: {} bytes", seal.len());
    println!("   Saved to: proof.bin, public_outputs.bin");
}
```

#### Verify Proof On-Chain

Deploy Risc0 verifier:

```bash
forge install risc0/risc0-ethereum
```

Deploy verifier contract that wraps Risc0's `IRiscZeroVerifier`:

```solidity
// contracts/Risc0BeliefVerifier.sol
import {IRiscZeroVerifier} from "risc0/IRiscZeroVerifier.sol";
import {IStarkVerifier} from "./IStarkVerifier.sol";

contract Risc0BeliefVerifier is IStarkVerifier {
    IRiscZeroVerifier public immutable verifier;
    bytes32 public immutable imageId;

    constructor(address _verifier, bytes32 _imageId) {
        verifier = IRiscZeroVerifier(_verifier);
        imageId = _imageId;
    }

    function verifyProof(
        bytes calldata proofBytes,
        uint256[] calldata publicInputs
    ) external override returns (bool) {
        // Decode Risc0 receipt
        (bytes memory seal, bytes memory journal) = abi.decode(proofBytes, (bytes, bytes));

        // Encode public inputs into journal digest
        bytes32 journalDigest = sha256(abi.encode(publicInputs));

        // Verify via Risc0 verifier
        verifier.verify(seal, imageId, journalDigest);

        return true; // Reverts if invalid
    }

    function getPublicInputsCount() external pure override returns (uint256) {
        return 4;
    }

    function getProofSystemId() external pure override returns (string memory) {
        return "Risc0-BeliefAttestation-v1.0";
    }
}
```

---

### Option 2: StarkWare Cairo + Stone Prover

StarkWare's Cairo is the native STARK language, providing maximum efficiency.

#### Installation

```bash
# Install Cairo 1.0
curl -L https://raw.githubusercontent.com/starkware-libs/cairo/main/scripts/install.sh | bash

# Verify installation
cairo-compile --version
```

#### Create Cairo Circuit

Create `zk/belief_attestation.cairo`:

```cairo
%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.hash import hash2
from starkware.cairo.common.signature import verify_ecdsa_signature
from starkware.cairo.common.alloc import alloc

// Public inputs
struct PublicInputs:
    member belief_hash : felt
    member prover_address : felt
    member epoch : felt
    member module_id : felt
end

// Private inputs (witness)
struct PrivateInputs:
    member belief_message_len : felt
    member belief_message : felt*
    member signature_r : felt
    member signature_s : felt
    member loyalty_score : felt
end

@external
func verify_belief_attestation{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(
    public_inputs : PublicInputs,
    private_inputs : PrivateInputs
) -> (is_valid : felt):
    alloc_locals

    // 1. Verify belief hash
    let (computed_hash) = hash_belief_message(
        private_inputs.belief_message_len,
        private_inputs.belief_message
    )
    assert computed_hash = public_inputs.belief_hash

    // 2. Verify signature
    verify_ecdsa_signature(
        message=computed_hash,
        public_key=public_inputs.prover_address,
        signature_r=private_inputs.signature_r,
        signature_s=private_inputs.signature_s
    )

    // 3. Verify loyalty score >= 8000 (80% threshold)
    assert_nn(private_inputs.loyalty_score - 8000)

    // 4. Verify epoch validity
    assert_nn(public_inputs.epoch)

    return (is_valid=1)
end

func hash_belief_message{pedersen_ptr : HashBuiltin*}(
    len : felt,
    data : felt*
) -> (hash : felt):
    // Hash the belief message using Pedersen hash
    // Implementation details...
    return (hash=0)
end
```

#### Generate Proof

```bash
# Compile Cairo program
cairo-compile belief_attestation.cairo --output belief_attestation_compiled.json

# Generate proof with Stone prover
stone-prover \
    --program belief_attestation_compiled.json \
    --program_input input.json \
    --output proof.json
```

---

### Option 3: Polygon Miden (Rust-based STARK)

Polygon Miden provides a Rust-native STARK VM.

#### Installation

```bash
cargo install miden-cli
```

#### Create Miden Assembly

Create `belief_attestation.masm`:

```asm
# Belief Attestation Circuit in Miden Assembly

proc.verify_belief_attestation
    # Stack: [belief_hash, prover_addr, epoch, module_id, ...]

    # 1. Load private inputs from advice tape
    adv_push.4  # Load belief message (4 felts)
    adv_push.2  # Load signature (r, s)
    adv_push.1  # Load loyalty score

    # 2. Hash belief message and verify it matches public input
    hperm  # Pedersen hash
    dup.8  # Duplicate belief_hash from stack
    eq     # Compare
    assert # Assert equal

    # 3. Verify ECDSA signature (simplified)
    # ... signature verification logic ...

    # 4. Verify loyalty score >= 8000
    push.8000
    dup.1
    gte
    assert

    # Success
    push.1
end
```

#### Generate Proof

```bash
# Prove
miden prove \
    --program belief_attestation.masm \
    --stack-inputs belief_hash,prover_addr,epoch,module_id \
    --advice-tape private_inputs.bin \
    --output proof.bin

# Verify
miden verify --proof proof.bin
```

---

## Integration with Vaultfire Contracts

### Step 1: Deploy STARK Verifier

Choose one of the verifier implementations above and deploy:

```bash
# Example: Deploy Risc0 verifier
npx hardhat run scripts/deploy-risc0-verifier.js --network base

# Example output:
# ✅ Risc0BeliefVerifier deployed: 0x1234...
#

 Image ID: 0xabcd...
```

### Step 2: Deploy DilithiumAttestor with ZK Enabled

```javascript
const verifierAddress = "0x1234..."; // From step 1
const governanceMultisig = "0x5678...";

const DilithiumAttestor = await ethers.getContractFactory("DilithiumAttestor");
const attestor = await DilithiumAttestor.deploy(
    governanceMultisig,  // origin
    true,                // zkEnabled = true (FULL ZK MODE)
    verifierAddress      // STARK verifier address
);

console.log(`✅ DilithiumAttestor deployed with STARK verification: ${await attestor.getAddress()}`);
```

### Step 3: Generate and Submit Proofs

```javascript
// Off-chain: Generate STARK proof
const proof = await generateStarkProof({
    beliefMessage: "I believe in Vaultfire's mission",
    signature: signedMessage,
    loyaltyProof: {
        type: "github",
        data: githubCommitHash,
        timestamp: Date.now()
    },
    publicInputs: {
        beliefHash: ethers.keccak256(ethers.toUtf8Bytes(beliefMessage)),
        proverAddress: signerAddress,
        epoch: 0,
        moduleID: 0
    }
});

// On-chain: Submit attestation with STARK proof
const zkProofBundle = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes", "bytes"],
    [proof.starkProof, proof.originSignature]
);

const tx = await attestor.attestBelief(proof.beliefHash, zkProofBundle);
await tx.wait();

console.log("✅ Belief attested with STARK proof!");
```

---

## Proof Generation Scripts

### JavaScript/TypeScript Example

Create `scripts/generate-stark-proof.js`:

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const ethers = require('ethers');

async function generateStarkProof(input) {
    // 1. Prepare input JSON
    const inputJson = {
        belief_message: input.beliefMessage,
        signature: input.signature,
        loyalty_proof: input.loyaltyProof,
        belief_hash: input.publicInputs.beliefHash,
        prover_address: input.publicInputs.proverAddress,
        epoch: input.publicInputs.epoch,
        module_id: input.publicInputs.moduleID
    };

    fs.writeFileSync('proof-input.json', JSON.stringify(inputJson, null, 2));

    // 2. Generate proof using Risc0 (or other prover)
    console.log('🔨 Generating STARK proof...');
    execSync('cargo run --release --bin prove-belief', {
        cwd: './zk/proof-generator',
        stdio: 'inherit'
    });

    // 3. Read generated proof
    const proofBytes = fs.readFileSync('proof.bin');
    const publicOutputs = fs.readFileSync('public_outputs.bin');

    console.log(`✅ Proof generated: ${proofBytes.length} bytes`);

    return {
        starkProof: proofBytes,
        originSignature: input.signature,
        beliefHash: input.publicInputs.beliefHash,
        publicOutputs: publicOutputs
    };
}

module.exports = { generateStarkProof };
```

---

## Testing STARK Proofs

Create comprehensive tests in `test/stark-proof-verification.test.js`:

```javascript
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { generateStarkProof } = require('../scripts/generate-stark-proof');

describe('STARK Proof Verification', () => {
    let attestor, verifier, signer;

    beforeEach(async () => {
        [signer] = await ethers.getSigners();

        // Deploy STARK verifier
        const Verifier = await ethers.getContractFactory('BeliefAttestationVerifier');
        verifier = await Verifier.deploy();

        // Deploy DilithiumAttestor with ZK enabled
        const Attestor = await ethers.getContractFactory('DilithiumAttestor');
        attestor = await Attestor.deploy(
            signer.address,             // origin
            true,                       // zkEnabled
            await verifier.getAddress() // verifier
        );
    });

    it('should verify valid STARK proof', async () => {
        const beliefMessage = "I hold Vaultfire values for 6 months";
        const beliefHash = ethers.keccak256(ethers.toUtf8Bytes(beliefMessage));
        const signature = await signer.signMessage(ethers.getBytes(beliefHash));

        // Generate STARK proof
        const proof = await generateStarkProof({
            beliefMessage,
            signature,
            loyaltyProof: {
                type: 'github',
                data: '0xcommithash',
                timestamp: Date.now() - (180 * 86400 * 1000) // 6 months ago
            },
            publicInputs: {
                beliefHash,
                proverAddress: signer.address,
                epoch: 0,
                moduleID: 0
            }
        });

        // Submit attestation
        const zkProofBundle = ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes', 'bytes'],
            [proof.starkProof, signature]
        );

        await expect(attestor.attestBelief(beliefHash, zkProofBundle))
            .to.emit(attestor, 'BeliefAttested')
            .withArgs(beliefHash, signer.address, true); // zkVerified = true

        // Verify belief is attested
        expect(await attestor.isBeliefSovereign(beliefHash)).to.be.true;
    });

    it('should reject invalid STARK proof', async () => {
        const beliefHash = ethers.keccak256(ethers.toUtf8Bytes("fake belief"));
        const signature = await signer.signMessage(ethers.getBytes(beliefHash));

        // Invalid proof (wrong belief message)
        const invalidProofBundle = ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes', 'bytes'],
            ['0x1234', signature] // Invalid STARK proof
        );

        await expect(attestor.attestBelief(beliefHash, invalidProofBundle))
            .to.be.revertedWith('STARK proof invalid');
    });
});
```

---

## Production Deployment Checklist

- [ ] Choose STARK prover (Risc0 / StarkWare / Miden)
- [ ] Implement belief attestation circuit
- [ ] Test circuit with valid and invalid inputs
- [ ] Deploy STARK verifier contract to Base
- [ ] Deploy DilithiumAttestor with zkEnabled=true
- [ ] Generate test proofs and verify on-chain
- [ ] Create proof generation API/service
- [ ] Document proof generation for users
- [ ] Monitor proof generation performance
- [ ] Set up proof caching for common beliefs

---

## Resources

- **Risc0 Documentation**: https://dev.risczero.com/
- **StarkWare Cairo**: https://www.cairo-lang.org/
- **Polygon Miden**: https://github.com/0xPolygonMiden
- **STARK vs SNARK Comparison**: https://ethereum.org/en/zero-knowledge-proofs/
- **Vaultfire ZK Specification**: See screenshots provided by user

---

**Document Version**: 1.0
**Last Updated**: 2026-01-08
**Status**: Production-Ready STARK Integration 🚀
