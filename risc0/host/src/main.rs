// SPDX-License-Identifier: MIT
//
// Vaultfire Belief Attestation — Host Program
// =============================================
//
// This binary is the host-side program that:
//   1. Accepts belief attestation parameters from the command line.
//   2. Constructs the guest input (AttestationInput).
//   3. Runs the guest program in the RISC Zero zkVM.
//   4. Generates a proof (STARK or Groth16).
//   5. Outputs the seal and journal for on-chain submission.
//
// Usage (local STARK proof):
//   cargo run --release -- \
//     --guest-elf ../guest/target/riscv-guest/riscv32im-risc0-zkvm-elf/release/vaultfire-belief-attestation-guest \
//     --belief-message "I believe in decentralised identity" \
//     --attester 0xf6A677de83C407875C9A9115Cf100F121f9c4816 \
//     --epoch 1 \
//     --module-id 1 \
//     --loyalty-score 9000
//
// Usage (Groth16 proof for on-chain verification):
//   cargo run --release -- \
//     --guest-elf <path> \
//     --belief-message "..." \
//     --attester 0x... \
//     --groth16
//
// For Boundless marketplace submission, use the boundless-integration binary.

use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::Parser;
use risc0_zkvm::{default_prover, ExecutorEnv, ProverOpts};
use serde::Serialize;
use sha2::{Digest, Sha256};

// ---------------------------------------------------------------------------
//  CLI Arguments
// ---------------------------------------------------------------------------

#[derive(Parser, Debug)]
#[command(
    name = "vaultfire-host",
    about = "Generate Vaultfire belief attestation ZK proofs locally"
)]
struct Args {
    /// Path to the compiled guest ELF binary.
    #[arg(long, env = "GUEST_ELF_PATH")]
    guest_elf: PathBuf,

    /// The raw belief message (will be hashed inside the guest).
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
    /// directly verifiable on-chain via the RISC Zero verifier router).
    #[arg(long, default_value_t = false)]
    groth16: bool,

    /// Output directory for proof artifacts.
    #[arg(long, default_value = ".")]
    output_dir: PathBuf,
}

// ---------------------------------------------------------------------------
//  Guest Input (must match the guest program's AttestationInput)
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
//  Main
// ---------------------------------------------------------------------------

fn main() -> Result<()> {
    // Initialise tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let args = Args::parse();

    // Load the guest ELF binary
    let guest_elf = std::fs::read(&args.guest_elf)
        .with_context(|| format!("Failed to read guest ELF from {:?}", args.guest_elf))?;
    tracing::info!(
        path = ?args.guest_elf,
        size = guest_elf.len(),
        "Loaded guest ELF"
    );

    // Parse attester address
    let attester_hex = args.attester.strip_prefix("0x").unwrap_or(&args.attester);
    let attester_bytes: [u8; 20] = hex::decode(attester_hex)
        .context("Invalid attester hex")?
        .try_into()
        .map_err(|_| anyhow::anyhow!("Attester must be 20 bytes"))?;

    // Get current timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs();

    // Build the guest input
    let input = AttestationInput {
        belief_message: args.belief_message.as_bytes().to_vec(),
        attester: attester_bytes,
        epoch: args.epoch,
        module_id: args.module_id,
        loyalty_score: args.loyalty_score,
        timestamp,
    };

    tracing::info!(
        attester = %args.attester,
        epoch = args.epoch,
        module_id = args.module_id,
        loyalty_score = args.loyalty_score,
        timestamp = timestamp,
        "Building proof for belief attestation"
    );

    // Build the executor environment with the guest input
    let env = ExecutorEnv::builder()
        .write(&input)?
        .build()?;

    // Select proof mode
    let opts = if args.groth16 {
        tracing::info!("Generating Groth16 proof (for on-chain verification)");
        ProverOpts::groth16()
    } else {
        tracing::info!("Generating STARK proof (for off-chain verification)");
        ProverOpts::default()
    };

    // Generate the proof
    tracing::info!("Starting proof generation (this may take several minutes)...");
    let prover = default_prover();
    let prove_info = prover
        .prove_with_opts(env, &guest_elf, &opts)
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

    // Compute journal digest (sha256) — this is what the on-chain verifier checks
    let journal_digest = Sha256::digest(&journal_bytes);

    // Extract seal bytes (Groth16 seal if available, otherwise empty)
    let seal_bytes = if args.groth16 {
        receipt
            .inner
            .groth16()
            .map(|g| g.seal.clone())
            .unwrap_or_default()
    } else {
        // For STARK proofs, serialize the full receipt
        bincode::serialize(&receipt).unwrap_or_default()
    };

    // Output results
    println!("\n=== Proof Generation Complete ===\n");
    println!("Image ID:           0x{}", hex::encode(prove_info.stats.image_id));
    println!("Journal (hex):      0x{}", hex::encode(&journal_bytes));
    println!("Journal length:     {} bytes", journal_bytes.len());
    println!("Journal digest:     0x{}", hex::encode(journal_digest));
    println!("Seal (hex):         0x{}", hex::encode(&seal_bytes));
    println!("Seal length:        {} bytes", seal_bytes.len());
    println!("Proof type:         {}", if args.groth16 { "Groth16" } else { "STARK" });

    // Save outputs to the specified directory
    let out = &args.output_dir;
    std::fs::create_dir_all(out)?;

    std::fs::write(out.join("proof_seal.bin"), &seal_bytes)
        .context("Failed to write seal")?;
    std::fs::write(out.join("proof_journal.bin"), &journal_bytes)
        .context("Failed to write journal")?;
    std::fs::write(out.join("proof_seal.hex"), format!("0x{}", hex::encode(&seal_bytes)))
        .context("Failed to write seal hex")?;
    std::fs::write(out.join("proof_journal.hex"), format!("0x{}", hex::encode(&journal_bytes)))
        .context("Failed to write journal hex")?;
    std::fs::write(
        out.join("image_id.hex"),
        format!("0x{}", hex::encode(prove_info.stats.image_id)),
    )
    .context("Failed to write image ID")?;
    std::fs::write(
        out.join("journal_digest.hex"),
        format!("0x{}", hex::encode(journal_digest)),
    )
    .context("Failed to write journal digest")?;

    println!("\nFiles written to {:?}:", out);
    println!("  proof_seal.bin       — Raw seal bytes");
    println!("  proof_seal.hex       — Hex-encoded seal");
    println!("  proof_journal.bin    — Raw journal bytes");
    println!("  proof_journal.hex    — Hex-encoded journal");
    println!("  image_id.hex         — Guest program image ID");
    println!("  journal_digest.hex   — SHA-256 digest of journal");
    println!("\nUse these with the ProductionBeliefAttestationVerifier:");
    println!("  verifier.verifyAttestation(seal, journal)");

    Ok(())
}
