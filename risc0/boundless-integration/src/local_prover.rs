// SPDX-License-Identifier: MIT
//
// Vaultfire Belief Attestation — Local Prover
// =============================================
//
// This module provides a local proving alternative for development and testing.
// It runs the RISC Zero prover on the local machine instead of submitting to
// Boundless.  This is useful for:
//
//   - Development and debugging of the guest program.
//   - Running tests without paying Boundless fees.
//   - CI/CD pipelines where Boundless access is not available.
//
// NOTE: Local proving requires significant CPU/GPU resources.  For production
// workloads, use the Boundless integration (main.rs) instead.
//
// Usage:
//   cargo run --release --bin local-prover -- \
//     --belief-message "I believe in decentralised identity" \
//     --attester 0xYourAddress \
//     --epoch 42 \
//     --module-id 1 \
//     --loyalty-score 9000

use anyhow::{Context, Result};
use clap::Parser;
use risc0_zkvm::{default_prover, ExecutorEnv, ProverOpts, VerifierContext};
use serde::Serialize;

// ---------------------------------------------------------------------------
//  CLI Arguments
// ---------------------------------------------------------------------------

#[derive(Parser, Debug)]
#[command(
    name = "vaultfire-local-prover",
    about = "Generate Vaultfire belief attestation proofs locally"
)]
struct Args {
    /// The raw belief message.
    #[arg(long)]
    belief_message: String,

    /// Attester Ethereum address (0x-prefixed).
    #[arg(long)]
    attester: String,

    /// Campaign / era identifier.
    #[arg(long, default_value_t = 0)]
    epoch: u32,

    /// Vaultfire module identifier.
    #[arg(long, default_value_t = 1)]
    module_id: u32,

    /// Loyalty / alignment score in basis points (0–10000).
    #[arg(long, default_value_t = 9000)]
    loyalty_score: u32,

    /// Generate a Groth16 proof (for on-chain verification).
    /// Without this flag, a STARK proof is generated (faster, but not
    /// directly verifiable on-chain).
    #[arg(long, default_value_t = false)]
    groth16: bool,
}

// ---------------------------------------------------------------------------
//  Guest Input
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct AttestationInput {
    belief_message: Vec<u8>,
    attester: [u8; 20],
    epoch: u32,
    module_id: u32,
    loyalty_score: u32,
    timestamp: u64,
}

// ---------------------------------------------------------------------------
//  Guest ELF
// ---------------------------------------------------------------------------

// Replace with the actual ELF path after building the guest program.
// In a monorepo: include!(concat!(env!("OUT_DIR"), "/methods.rs"));
const GUEST_ELF: &[u8] = &[];

// ---------------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------------

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    let args = Args::parse();

    // Parse attester address
    let attester_hex = args.attester.strip_prefix("0x").unwrap_or(&args.attester);
    let attester_bytes: [u8; 20] = hex::decode(attester_hex)
        .context("Invalid attester hex")?
        .try_into()
        .map_err(|_| anyhow::anyhow!("Attester must be 20 bytes"))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs();

    let input = AttestationInput {
        belief_message: args.belief_message.as_bytes().to_vec(),
        attester: attester_bytes,
        epoch: args.epoch,
        module_id: args.module_id,
        loyalty_score: args.loyalty_score,
        timestamp,
    };

    tracing::info!("Building executor environment...");

    let env = ExecutorEnv::builder()
        .write(&input)?
        .build()?;

    tracing::info!("Starting proof generation (this may take several minutes)...");

    let prover = default_prover();

    let opts = if args.groth16 {
        tracing::info!("Generating Groth16 proof (for on-chain verification)");
        ProverOpts::groth16()
    } else {
        tracing::info!("Generating STARK proof (for off-chain verification)");
        ProverOpts::default()
    };

    let prove_info = prover
        .prove_with_opts(env, GUEST_ELF, &opts)
        .context("Proof generation failed")?;

    let receipt = prove_info.receipt;

    tracing::info!("Proof generated successfully!");

    // Verify locally before outputting
    receipt
        .verify(prove_info.stats.image_id)
        .context("Local verification failed")?;

    tracing::info!("Local verification passed!");

    // Extract journal and seal
    let journal_bytes = receipt.journal.bytes.clone();
    let seal_bytes = receipt.inner.groth16().map(|g| g.seal.clone()).unwrap_or_default();

    println!("\n=== Local Proof Generation Complete ===\n");
    println!("Image ID:      0x{}", hex::encode(prove_info.stats.image_id));
    println!("Journal (hex): 0x{}", hex::encode(&journal_bytes));
    println!("Seal (hex):    0x{}", hex::encode(&seal_bytes));

    // Save outputs
    std::fs::write("proof_seal.bin", &seal_bytes)?;
    std::fs::write("proof_journal.bin", &journal_bytes)?;
    std::fs::write("proof_seal.hex", format!("0x{}", hex::encode(&seal_bytes)))?;
    std::fs::write("proof_journal.hex", format!("0x{}", hex::encode(&journal_bytes)))?;

    println!("\nFiles written to current directory.");

    Ok(())
}
