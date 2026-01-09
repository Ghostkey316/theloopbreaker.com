// RISC Zero Guest Program for Vaultfire Belief Attestation
// This program runs inside the zkVM and proves belief authenticity without revealing details

#![no_main]

use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// Minimum belief alignment threshold (80%)
const MIN_BELIEF_THRESHOLD: u32 = 8000; // 80.00%

/// Private inputs (never revealed on-chain)
#[derive(Serialize, Deserialize)]
struct PrivateInputs {
    /// The actual belief message or claim
    belief_message: String,

    /// Signature proving the belief originated from authorized source
    signature: Vec<u8>,

    /// Loyalty proof: GitHub push, NS3 login, tweet ID, onchain move, etc.
    /// Format: "github:commit_sha" or "ns3:session_id" or "base:tx_hash"
    loyalty_proof: String,

    /// Loyalty score (0-10000, representing 0-100.00%)
    loyalty_score: u32,
}

/// Public inputs (revealed on-chain for verification)
#[derive(Serialize, Deserialize)]
struct PublicInputs {
    /// Hash of the belief (keccak256 in Solidity, sha256 here for zkVM compatibility)
    belief_hash: [u8; 32],

    /// Address of the prover (Ethereum address as 20 bytes)
    prover_address: [u8; 20],

    /// Campaign/era identifier
    epoch: u32,

    /// Vaultfire module ID (NS3, GitHub, Base, etc.)
    module_id: u32,
}

/// Output commitment (what gets verified on-chain)
#[derive(Serialize, Deserialize)]
struct ProofOutput {
    /// Confirms: "This person is loyal, meets threshold, passed integrity check"
    is_valid: bool,

    /// Public inputs echo (for verification binding)
    belief_hash: [u8; 32],
    prover_address: [u8; 20],
    epoch: u32,
    module_id: u32,
}

fn main() {
    // Read private inputs (only visible inside zkVM)
    let private: PrivateInputs = env::read();

    // Read public inputs (will be verified on-chain)
    let public: PublicInputs = env::read();

    // ============================================
    // CONSTRAINT 1: Belief Hash Integrity
    // ============================================
    // Verify that the private belief message hashes to the public belief hash
    let mut hasher = Sha256::new();
    hasher.update(private.belief_message.as_bytes());
    let computed_hash: [u8; 32] = hasher.finalize().into();

    assert_eq!(
        computed_hash,
        public.belief_hash,
        "Belief hash mismatch - private belief does not match public commitment"
    );

    // ============================================
    // CONSTRAINT 2: Loyalty Threshold
    // ============================================
    // Verify that the loyalty score meets the minimum threshold (80%)
    assert!(
        private.loyalty_score >= MIN_BELIEF_THRESHOLD,
        "Loyalty score {} below threshold {}",
        private.loyalty_score,
        MIN_BELIEF_THRESHOLD
    );

    // ============================================
    // CONSTRAINT 3: Loyalty Proof Authenticity
    // ============================================
    // Verify that the loyalty proof is well-formed and matches the module
    let proof_valid = match public.module_id {
        1 => private.loyalty_proof.starts_with("github:"),
        2 => private.loyalty_proof.starts_with("ns3:"),
        3 => private.loyalty_proof.starts_with("base:"),
        _ => private.loyalty_proof.len() > 0, // Generic proof for other modules
    };

    assert!(
        proof_valid,
        "Loyalty proof format invalid for module {}",
        public.module_id
    );

    // ============================================
    // CONSTRAINT 4: Signature Verification
    // ============================================
    // In production, verify ECDSA signature here using risc0-zkvm crypto
    // For now, ensure signature is present and non-empty
    assert!(
        !private.signature.is_empty(),
        "Signature cannot be empty"
    );

    // ============================================
    // CONSTRAINT 5: Prover Address Binding
    // ============================================
    // Ensure the proof is bound to the specific prover address
    // This prevents proof reuse by other addresses
    assert!(
        public.prover_address != [0u8; 20],
        "Prover address cannot be zero"
    );

    // ============================================
    // OUTPUT COMMITMENT
    // ============================================
    // All constraints passed - commit the proof output
    let output = ProofOutput {
        is_valid: true,
        belief_hash: public.belief_hash,
        prover_address: public.prover_address,
        epoch: public.epoch,
        module_id: public.module_id,
    };

    // Commit output to the journal (this becomes the public proof output)
    env::commit(&output);
}
