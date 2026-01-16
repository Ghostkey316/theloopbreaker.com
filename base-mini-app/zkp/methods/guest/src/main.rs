// Vaultfire Belief Attestation ZK Guest Program
// Runs inside RISC Zero zkVM to generate cryptographic proofs

#![no_main]

use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};
use serde_json;
use sha3::{Digest, Keccak256};

/// Inputs to the ZK proof (private, not revealed)
#[derive(Serialize, Deserialize)]
pub struct BeliefProofInputs {
    /// The actual belief text (PRIVATE - never revealed)
    pub belief: String,
    /// The expected Keccak256 hash of the belief (public)
    pub expected_belief_hash: [u8; 32],
    /// Loyalty score in basis points (0-10000) (PRIVATE)
    pub loyalty_score: u32,
    /// Module ID (GitHub=0, NS3=1, Base=2, etc.)
    pub module_id: u32,
    /// Activity proof data (PRIVATE)
    pub activity_proof: String,
    /// Prover's Ethereum address (public)
    pub prover_address: [u8; 20],
}

/// Public outputs from the ZK proof (revealed on-chain)
#[derive(Serialize, Deserialize)]
pub struct BeliefProofOutputs {
    /// Keccak256 hash of the belief
    pub belief_hash: [u8; 32],
    /// Module ID
    pub module_id: u32,
    /// Loyalty score (revealed only if >= threshold)
    pub loyalty_score_valid: bool,
    /// Prover's address
    pub prover_address: [u8; 20],
}

fn main() {
    // Read private inputs from the host
    let inputs: BeliefProofInputs = env::read();

    // 1. Compute Keccak256 hash of the belief
    let mut hasher = Keccak256::new();
    hasher.update(inputs.belief.as_bytes());
    let computed_hash: [u8; 32] = hasher.finalize().into();

    // 2. Verify the computed hash matches the expected hash
    assert_eq!(
        computed_hash, inputs.expected_belief_hash,
        "Belief hash mismatch - proof failed"
    );

    // 3. Validate loyalty score is in valid range (0-10000 basis points = 0-100%)
    assert!(
        inputs.loyalty_score <= 10000,
        "Loyalty score exceeds maximum (10000 basis points)"
    );

    // 4. Validate module ID is within valid range (updated to support all modules)
    // Modules: GITHUB(0), NS3(1), BASE(2), CREDENTIAL(3), REPUTATION(4),
    //          IDENTITY(5), GOVERNANCE(6), GENERIC(7), AI_AGENT(8),
    //          WORK_HISTORY(9), EDUCATION(10), HUMANITY_PROOF(11)
    assert!(
        inputs.module_id <= 11,
        "Invalid module ID (must be 0-11)"
    );

    // 5. For production: verify loyalty score calculation based on activity proof
    // This would include verifying GitHub commits, NS3 messages, Base txs, etc.
    // For now, we trust the loyalty score provided (can be enhanced per module)
    let loyalty_score_valid = match inputs.module_id {
        0 => verify_github_loyalty(&inputs.activity_proof, inputs.loyalty_score),
        1 => verify_ns3_loyalty(&inputs.activity_proof, inputs.loyalty_score),
        2 => verify_base_loyalty(&inputs.activity_proof, inputs.loyalty_score),
        _ => inputs.loyalty_score >= 0 && inputs.loyalty_score <= 10000,
    };

    // 6. Commit public outputs (this is what gets verified on-chain)
    let outputs = BeliefProofOutputs {
        belief_hash: computed_hash,
        module_id: inputs.module_id,
        loyalty_score_valid,
        prover_address: inputs.prover_address,
    };

    env::commit(&outputs);
}

// Activity proof structures matching TypeScript definitions

#[derive(Deserialize)]
struct GitHubActivity {
    total_commits: u32,
    total_prs: u32,
    account_age_years: f64,
    contribution_streak: u32,
}

#[derive(Deserialize)]
struct NS3Activity {
    total_messages: u32,
    average_quality_score: u32, // 0-100
    account_age_months: u32,
    recipient_count: u32,
}

#[derive(Deserialize)]
struct BaseActivity {
    total_transactions: u32,
    total_volume_usd: f64,
    nft_count: u32,
    unique_contracts_interacted: u32,
    account_age_months: u32,
}

#[derive(Deserialize)]
struct ActivityProof<T> {
    module_id: u32,
    activity: T,
    timestamp: u64,
}

/// Verify GitHub activity-based loyalty score
///
/// Scoring breakdown (matches TypeScript implementation):
/// - Commits: Up to 3000 points (10 points per commit, max 300 commits)
/// - Pull Requests: Up to 3000 points (15 points per PR, max 200 PRs)
/// - Account Age: Up to 2000 points (1000 points per year, max 2 years)
/// - Contribution Streak: Up to 2000 points (5 points per day, max 400 days)
fn verify_github_loyalty(activity_proof: &str, claimed_score: u32) -> bool {
    // Parse JSON activity proof
    let proof: ActivityProof<GitHubActivity> = match serde_json::from_str(activity_proof) {
        Ok(p) => p,
        Err(_) => return false, // Invalid JSON format
    };

    let activity = proof.activity;

    // Calculate score using exact algorithm from loyalty-calculator.ts
    let commit_score = core::cmp::min(activity.total_commits * 10, 3000);
    let pr_score = core::cmp::min(activity.total_prs * 15, 3000);
    let age_score = core::cmp::min((activity.account_age_years * 1000.0) as u32, 2000);
    let streak_score = core::cmp::min(activity.contribution_streak * 5, 2000);

    let calculated_score = core::cmp::min(
        commit_score + pr_score + age_score + streak_score,
        10000
    );

    // Allow small tolerance (100 basis points = 1%) for floating point differences
    let diff = if claimed_score > calculated_score {
        claimed_score - calculated_score
    } else {
        calculated_score - claimed_score
    };

    diff <= 100 && claimed_score <= 10000
}

/// Verify NS3 protocol activity-based loyalty score
///
/// Scoring breakdown (matches TypeScript implementation):
/// - Message Count: Up to 3000 points (3 points per message, max 1000 messages)
/// - Quality Score: Up to 3000 points (30x average quality)
/// - Account Age: Up to 2000 points (200 points per month, max 10 months)
/// - Network Effect: Up to 2000 points (10 points per unique recipient, max 200)
fn verify_ns3_loyalty(activity_proof: &str, claimed_score: u32) -> bool {
    let proof: ActivityProof<NS3Activity> = match serde_json::from_str(activity_proof) {
        Ok(p) => p,
        Err(_) => return false,
    };

    let activity = proof.activity;

    // Calculate score using exact algorithm from loyalty-calculator.ts
    let message_score = core::cmp::min(activity.total_messages * 3, 3000);
    let quality_score = core::cmp::min(activity.average_quality_score * 30, 3000);
    let age_score = core::cmp::min(activity.account_age_months * 200, 2000);
    let network_score = core::cmp::min(activity.recipient_count * 10, 2000);

    let calculated_score = core::cmp::min(
        message_score + quality_score + age_score + network_score,
        10000
    );

    // Allow small tolerance
    let diff = if claimed_score > calculated_score {
        claimed_score - calculated_score
    } else {
        calculated_score - claimed_score
    };

    diff <= 100 && claimed_score <= 10000
}

/// Verify Base blockchain activity-based loyalty score
///
/// Scoring breakdown (matches TypeScript implementation):
/// - Transaction Count: Up to 2500 points (5 points per tx, max 500 txs)
/// - Volume: Up to 2500 points (based on USD volume tiers)
/// - NFT Holdings: Up to 2000 points (20 points per NFT, max 100 NFTs)
/// - Contract Interactions: Up to 2000 points (10 points per unique contract, max 200)
/// - Account Age: Up to 1000 points (100 points per month, max 10 months)
fn verify_base_loyalty(activity_proof: &str, claimed_score: u32) -> bool {
    let proof: ActivityProof<BaseActivity> = match serde_json::from_str(activity_proof) {
        Ok(p) => p,
        Err(_) => return false,
    };

    let activity = proof.activity;

    // Calculate score using exact algorithm from loyalty-calculator.ts
    let tx_score = core::cmp::min(activity.total_transactions * 5, 2500);

    // Volume score with tiered thresholds
    let volume_score = if activity.total_volume_usd >= 100000.0 {
        2500
    } else if activity.total_volume_usd >= 50000.0 {
        2000
    } else if activity.total_volume_usd >= 10000.0 {
        1500
    } else if activity.total_volume_usd >= 1000.0 {
        1000
    } else {
        core::cmp::min(activity.total_volume_usd as u32, 1000)
    };

    let nft_score = core::cmp::min(activity.nft_count * 20, 2000);
    let contract_score = core::cmp::min(activity.unique_contracts_interacted * 10, 2000);
    let age_score = core::cmp::min(activity.account_age_months * 100, 1000);

    let calculated_score = core::cmp::min(
        tx_score + volume_score + nft_score + contract_score + age_score,
        10000
    );

    // Allow small tolerance
    let diff = if claimed_score > calculated_score {
        claimed_score - calculated_score
    } else {
        calculated_score - claimed_score
    };

    diff <= 100 && claimed_score <= 10000
}
