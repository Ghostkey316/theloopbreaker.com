// Vaultfire ZKP Host - Proof Generation Library
// Generates RISC Zero STARK proofs for belief attestations

use risc0_zkvm::{default_prover, ExecutorEnv, ProverOpts, VerifierContext};
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};

// Import the guest program's image ID and ELF
vaultfire_methods::include_all!();

/// Input data for generating a belief attestation proof
#[derive(Serialize, Deserialize, Clone)]
pub struct BeliefProofInputs {
    /// The actual belief text (kept private in ZK proof)
    pub belief: String,
    /// Expected Keccak256 hash of the belief
    pub expected_belief_hash: Vec<u8>,
    /// Loyalty score in basis points (0-10000)
    pub loyalty_score: u32,
    /// Module ID (0=GitHub, 1=NS3, 2=Base, etc.)
    pub module_id: u32,
    /// Activity proof data (JSON or hex string)
    pub activity_proof: String,
    /// Prover's Ethereum address (20 bytes)
    pub prover_address: Vec<u8>,
}

/// ZK Proof output with STARK proof bytes
#[derive(Serialize, Deserialize)]
pub struct BeliefProof {
    /// RISC Zero STARK proof bytes
    pub proof_bytes: Vec<u8>,
    /// Public outputs (belief hash, module ID, etc.)
    pub public_outputs: PublicOutputs,
    /// Image ID of the guest program (for verification)
    pub image_id: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
pub struct PublicOutputs {
    pub belief_hash: Vec<u8>,
    pub module_id: u32,
    pub loyalty_score_valid: bool,
    pub prover_address: Vec<u8>,
}

/// Generate a RISC Zero STARK proof for a belief attestation
pub fn generate_belief_proof(inputs: BeliefProofInputs) -> Result<BeliefProof, String> {
    // Validate inputs
    if inputs.belief.is_empty() {
        return Err("Belief text cannot be empty".to_string());
    }
    if inputs.expected_belief_hash.len() != 32 {
        return Err("Belief hash must be 32 bytes".to_string());
    }
    if inputs.loyalty_score > 10000 {
        return Err("Loyalty score cannot exceed 10000 basis points".to_string());
    }
    if inputs.prover_address.len() != 20 {
        return Err("Prover address must be 20 bytes".to_string());
    }

    // Compute Keccak256 hash of belief to verify it matches
    let mut hasher = Keccak256::new();
    hasher.update(inputs.belief.as_bytes());
    let computed_hash = hasher.finalize();

    if computed_hash.as_slice() != inputs.expected_belief_hash.as_slice() {
        return Err("Belief hash mismatch".to_string());
    }

    // Prepare guest inputs
    let guest_inputs = GuestInputs {
        belief: inputs.belief.clone(),
        expected_belief_hash: inputs.expected_belief_hash
            .clone()
            .try_into()
            .map_err(|_| "Invalid belief hash length")?,
        loyalty_score: inputs.loyalty_score,
        module_id: inputs.module_id,
        activity_proof: inputs.activity_proof.clone(),
        prover_address: inputs.prover_address
            .clone()
            .try_into()
            .map_err(|_| "Invalid prover address length")?,
    };

    // Create executor environment and write inputs
    let env = ExecutorEnv::builder()
        .write(&guest_inputs)
        .map_err(|e| format!("Failed to write inputs: {}", e))?
        .build()
        .map_err(|e| format!("Failed to build executor env: {}", e))?;

    // Generate the proof using RISC Zero prover
    let prover = default_prover();
    let prove_info = prover
        .prove_with_ctx(
            env,
            &VerifierContext::default(),
            BELIEF_GUEST_ELF,
            &ProverOpts::groth16(),
        )
        .map_err(|e| format!("Proof generation failed: {}", e))?;

    // Extract receipt and journal
    let receipt = prove_info.receipt;
    let journal = receipt.journal.bytes.clone();

    // Decode public outputs from journal
    let public_outputs: GuestOutputs = bincode::deserialize(&journal)
        .map_err(|e| format!("Failed to decode public outputs: {}", e))?;

    // Serialize the receipt (this contains the STARK proof)
    let proof_bytes = bincode::serialize(&receipt)
        .map_err(|e| format!("Failed to serialize proof: {}", e))?;

    Ok(BeliefProof {
        proof_bytes,
        public_outputs: PublicOutputs {
            belief_hash: public_outputs.belief_hash.to_vec(),
            module_id: public_outputs.module_id,
            loyalty_score_valid: public_outputs.loyalty_score_valid,
            prover_address: public_outputs.prover_address.to_vec(),
        },
        image_id: BELIEF_GUEST_ID.to_vec(),
    })
}

// Internal types matching the guest program
#[derive(Serialize, Deserialize)]
struct GuestInputs {
    pub belief: String,
    pub expected_belief_hash: [u8; 32],
    pub loyalty_score: u32,
    pub module_id: u32,
    pub activity_proof: String,
    pub prover_address: [u8; 20],
}

#[derive(Serialize, Deserialize)]
struct GuestOutputs {
    pub belief_hash: [u8; 32],
    pub module_id: u32,
    pub loyalty_score_valid: bool,
    pub prover_address: [u8; 20],
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proof_generation() {
        let belief = "I believe in decentralized trust infrastructure";

        // Compute hash
        let mut hasher = Keccak256::new();
        hasher.update(belief.as_bytes());
        let belief_hash = hasher.finalize();

        let inputs = BeliefProofInputs {
            belief: belief.to_string(),
            expected_belief_hash: belief_hash.to_vec(),
            loyalty_score: 9500,
            module_id: 0,
            activity_proof: r#"{"commits": 100, "prs": 50}"#.to_string(),
            prover_address: vec![0u8; 20],
        };

        let result = generate_belief_proof(inputs);
        assert!(result.is_ok(), "Proof generation should succeed");

        let proof = result.unwrap();
        assert!(!proof.proof_bytes.is_empty(), "Proof bytes should not be empty");
        assert_eq!(proof.public_outputs.module_id, 0);
        assert!(proof.public_outputs.loyalty_score_valid);
    }
}
