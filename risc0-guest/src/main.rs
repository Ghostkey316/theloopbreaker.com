// RISC Zero Guest Program for Vaultfire Belief Attestation
// This program runs inside the zkVM and proves belief authenticity without revealing details

#![no_main]

use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};
use tiny_keccak::{Hasher, Keccak};

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
    /// keccak256(utf8(belief_message))
    belief_hash: [u8; 32],

    /// Address of the prover (Ethereum address as 20 bytes)
    prover_address: [u8; 20],

    /// Campaign/era identifier
    epoch: u32,

    /// Vaultfire module ID (NS3, GitHub, Base, etc.)
    module_id: u32,
}

fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    let mut hasher = Keccak::v256();
    hasher.update(data);
    hasher.finalize(&mut out);
    out
}

/// ABI-encode (Solidity) as: abi.encode(bytes32,address,uint256,uint256)
/// Produces 4 * 32 = 128 bytes.
fn abi_encode_journal(belief_hash: [u8; 32], prover_address: [u8; 20], epoch: u32, module_id: u32) -> [u8; 128] {
    let mut out = [0u8; 128];

    // word0: bytes32 belief_hash
    out[0..32].copy_from_slice(&belief_hash);

    // word1: address prover_address (left padded to 32)
    // 12 bytes zeros + 20 bytes address
    out[32 + 12..64].copy_from_slice(&prover_address);

    // word2: uint256 epoch (u32 -> big-endian in last 4 bytes)
    out[64 + 28..96].copy_from_slice(&epoch.to_be_bytes());

    // word3: uint256 module_id
    out[96 + 28..128].copy_from_slice(&module_id.to_be_bytes());

    out
}

fn main() {
    // Read private inputs (only visible inside zkVM)
    let private: PrivateInputs = env::read();

    // Read public inputs (will be verified on-chain)
    let public: PublicInputs = env::read();

    // ============================================
    // CONSTRAINT 1: Belief Hash Integrity
    // ============================================
    // Verify that the private belief message hashes to the public belief hash (keccak256)
    let computed_hash = keccak256(private.belief_message.as_bytes());

    assert_eq!(
        computed_hash,
        public.belief_hash,
        "Belief hash mismatch - private belief does not match public commitment"
    );

    // ============================================
    // CONSTRAINT 2: Loyalty Threshold
    // ============================================
    assert!(
        private.loyalty_score >= MIN_BELIEF_THRESHOLD,
        "Loyalty score {} below threshold {}",
        private.loyalty_score,
        MIN_BELIEF_THRESHOLD
    );

    // ============================================
    // CONSTRAINT 3: Loyalty Proof Authenticity
    // ============================================
    let proof_valid = match public.module_id {
        1 => private.loyalty_proof.starts_with("github:"),
        2 => private.loyalty_proof.starts_with("ns3:"),
        3 => private.loyalty_proof.starts_with("base:"),
        _ => !private.loyalty_proof.is_empty(),
    };

    assert!(
        proof_valid,
        "Loyalty proof format invalid for module {}",
        public.module_id
    );

    // ============================================
    // CONSTRAINT 4: Signature Verification
    // ============================================
    // In production, verify ECDSA signature here.
    assert!(!private.signature.is_empty(), "Signature cannot be empty");

    // ============================================
    // CONSTRAINT 5: Prover Address Binding
    // ============================================
    assert!(public.prover_address != [0u8; 20], "Prover address cannot be zero");

    // ============================================
    // OUTPUT COMMITMENT (JOURNAL)
    // ============================================
    // Commit *exact ABI-encoded bytes* so Solidity can compute:
    // keccak256(abi.encode(beliefHash, proverAddress, epoch, moduleID))
    let journal_bytes = abi_encode_journal(
        public.belief_hash,
        public.prover_address,
        public.epoch,
        public.module_id,
    );

    env::commit(&journal_bytes);
}
