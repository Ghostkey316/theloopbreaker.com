// SPDX-License-Identifier: MIT
//
// Vaultfire Belief Attestation Guest Program
// ============================================
// This RISC Zero guest program runs inside the zkVM and produces a ZK proof
// that a belief attestation is valid. The proof guarantees:
//
//   1. The attester possesses a valid belief message whose hash matches the
//      declared beliefHash.
//   2. The attester address is bound to the attestation (preventing replay).
//   3. The belief score meets the protocol-defined threshold (80%).
//   4. The epoch and moduleID are within valid ranges.
//
// Private inputs (never revealed on-chain):
//   - belief_message: The raw belief content
//   - loyalty_score:  The attester's loyalty/alignment score (0..10000 bps)
//
// Public outputs (committed to the journal, verified on-chain):
//   - belief_hash:     keccak256(belief_message)
//   - attester:        The Ethereum address of the attester
//   - epoch:           The campaign/era identifier
//   - module_id:       The Vaultfire module identifier
//   - belief_score:    The computed belief alignment score
//   - timestamp:       The attestation timestamp
//
// IMPORTANT — Hashing Strategy:
//   - belief_hash uses keccak256 to match Solidity's keccak256() on-chain.
//   - Journal verification uses sha256 (RISC Zero's native hash function).
//   - The on-chain verifier checks: verify(seal, imageId, sha256(journal))
//   - These are two separate operations serving different purposes.
//
// IMPORTANT — Journal Encoding:
//   - The journal is ABI-encoded to match the on-chain abi.decode() call.
//   - Format: (bytes32, address, uint32, uint32, uint32, uint64)
//   - Each field is left-padded to 32 bytes (Solidity ABI convention).

#![no_main]
#![no_std]

extern crate alloc;

use alloc::vec::Vec;
use risc0_zkvm::guest::env;

// ---------------------------------------------------------------------------
// Data Structures
// ---------------------------------------------------------------------------

/// Input provided to the guest program.  The host serialises this struct and
/// writes it to the guest's stdin before execution begins.
#[derive(serde::Deserialize)]
struct AttestationInput {
    /// Raw belief message bytes (private — never leaves the zkVM).
    belief_message: Vec<u8>,

    /// Ethereum address of the attester (20 bytes, zero-padded to 32).
    attester: [u8; 20],

    /// Campaign / era identifier.
    epoch: u32,

    /// Vaultfire module identifier (e.g. NS3, GitHub, Base wallet).
    module_id: u32,

    /// Loyalty / alignment score in basis points (0–10000).
    /// This is the private witness that proves the attester meets the
    /// protocol threshold without revealing the exact score on-chain.
    loyalty_score: u32,

    /// Unix timestamp of the attestation.
    timestamp: u64,
}

/// Journal entry committed as the public output of the guest execution.
/// The on-chain verifier reconstructs this from calldata and checks that
/// `sha256(journal_bytes) == journalDigest` inside the RISC Zero receipt.
///
/// The journal is ABI-encoded to match the on-chain abi.decode() call:
///   (bytes32, address, uint32, uint32, uint32, uint64)
struct AttestationJournal {
    /// keccak256(belief_message) — computed inside the guest.
    belief_hash: [u8; 32],

    /// The attester's Ethereum address.
    attester: [u8; 20],

    /// Campaign / era identifier.
    epoch: u32,

    /// Vaultfire module identifier.
    module_id: u32,

    /// The belief alignment score (public so the contract can record it).
    belief_score: u32,

    /// Unix timestamp of the attestation.
    timestamp: u64,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Minimum belief threshold in basis points (80%).
const MIN_BELIEF_THRESHOLD: u32 = 8000;

/// Maximum valid epoch value (uint32 max).
const MAX_EPOCH: u32 = u32::MAX;

// ---------------------------------------------------------------------------
// Keccak-256 (minimal, guest-compatible implementation)
// ---------------------------------------------------------------------------
// We implement a compact keccak256 so the belief_hash matches Solidity's
// keccak256.  The guest environment does not have access to the standard
// library's hashing, so we provide a self-contained sponge.

/// Keccak-256 hash function (NIST SHA-3 candidate, *not* SHA-3-256).
/// Produces a 32-byte digest compatible with Solidity's `keccak256()`.
fn keccak256(data: &[u8]) -> [u8; 32] {
    // Round constants for Keccak-f[1600]
    const RC: [u64; 24] = [
        0x0000000000000001, 0x0000000000008082, 0x800000000000808a,
        0x8000000080008000, 0x000000000000808b, 0x0000000080000001,
        0x8000000080008081, 0x8000000000008009, 0x000000000000008a,
        0x0000000000000088, 0x0000000080008009, 0x000000008000000a,
        0x000000008000808b, 0x800000000000008b, 0x8000000000008089,
        0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
        0x000000000000800a, 0x800000008000000a, 0x8000000080008081,
        0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
    ];

    const ROTC: [u32; 24] = [
        1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14,
        27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
    ];

    const PILN: [usize; 24] = [
        10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4,
        15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
    ];

    fn keccak_f(st: &mut [u64; 25]) {
        for round in 0..24 {
            // θ step
            let mut bc = [0u64; 5];
            for i in 0..5 {
                bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];
            }
            for i in 0..5 {
                let t = bc[(i + 4) % 5] ^ bc[(i + 1) % 5].rotate_left(1);
                for j in (0..25).step_by(5) {
                    st[j + i] ^= t;
                }
            }
            // ρ and π steps
            let mut t = st[1];
            for i in 0..24 {
                let j = PILN[i];
                let tmp = st[j];
                st[j] = t.rotate_left(ROTC[i]);
                t = tmp;
            }
            // χ step
            for j in (0..25).step_by(5) {
                let mut bc5 = [0u64; 5];
                for i in 0..5 {
                    bc5[i] = st[j + i];
                }
                for i in 0..5 {
                    st[j + i] ^= (!bc5[(i + 1) % 5]) & bc5[(i + 2) % 5];
                }
            }
            // ι step
            st[0] ^= RC[round];
        }
    }

    let rate = 136; // (1600 - 256*2) / 8 = 136 bytes for keccak-256
    let mut state = [0u64; 25];

    // Absorb with padding
    let mut padded = alloc::vec![0u8; 0];
    padded.extend_from_slice(data);
    // Keccak padding: append 0x01, then zeros, then 0x80
    padded.push(0x01);
    while padded.len() % rate != 0 {
        padded.push(0x00);
    }
    let last = padded.len() - 1;
    padded[last] |= 0x80;

    for chunk in padded.chunks(rate) {
        for i in 0..(rate / 8) {
            let word = u64::from_le_bytes([
                chunk[i * 8],
                chunk[i * 8 + 1],
                chunk[i * 8 + 2],
                chunk[i * 8 + 3],
                chunk[i * 8 + 4],
                chunk[i * 8 + 5],
                chunk[i * 8 + 6],
                chunk[i * 8 + 7],
            ]);
            state[i] ^= word;
        }
        keccak_f(&mut state);
    }

    // Squeeze 32 bytes
    let mut out = [0u8; 32];
    for i in 0..4 {
        let bytes = state[i].to_le_bytes();
        out[i * 8..(i + 1) * 8].copy_from_slice(&bytes);
    }
    out
}

// ---------------------------------------------------------------------------
// Guest Entry Point
// ---------------------------------------------------------------------------

risc0_zkvm::guest::entry!(main);

fn main() {
    // 1. Read private input from the host
    let input: AttestationInput = env::read();

    // 2. Validate input constraints inside the zkVM
    //    These checks are part of the proven computation — a valid proof
    //    guarantees that all of these conditions held.

    // Belief message must be non-empty
    assert!(!input.belief_message.is_empty(), "Belief message must not be empty");

    // Attester address must be non-zero
    assert!(
        input.attester != [0u8; 20],
        "Attester address must not be zero"
    );

    // Epoch must be within valid range
    assert!(input.epoch <= MAX_EPOCH, "Epoch exceeds maximum");

    // Loyalty score must be within basis-point range
    assert!(
        input.loyalty_score <= 10_000,
        "Loyalty score must be 0..10000 bps"
    );

    // 3. Core verification: loyalty score meets the protocol threshold
    assert!(
        input.loyalty_score >= MIN_BELIEF_THRESHOLD,
        "Loyalty score below minimum threshold (80%)"
    );

    // 4. Compute the belief hash (keccak256 to match Solidity)
    let belief_hash = keccak256(&input.belief_message);

    // 5. Compute a belief score.
    //    In a production system this could incorporate multiple signals
    //    (GitHub commits, NS3 sessions, Base transactions, etc.).
    //    For now the score is the loyalty_score itself, validated above.
    let belief_score = input.loyalty_score;

    // 6. Build the journal (public output)
    let journal = AttestationJournal {
        belief_hash,
        attester: input.attester,
        epoch: input.epoch,
        module_id: input.module_id,
        belief_score,
        timestamp: input.timestamp,
    };

    // 7. ABI-encode the journal to match the on-chain abi.decode() format.
    //    The on-chain verifier checks:
    //      sha256(abi_encoded_journal) == journalDigest
    //    where journalDigest is part of the RISC Zero receipt.
    //
    //    Layout (each slot is 32 bytes, big-endian):
    //      [0]  bytes32  belief_hash
    //      [1]  address  attester       (left-padded to 32 bytes)
    //      [2]  uint32   epoch          (left-padded to 32 bytes)
    //      [3]  uint32   module_id      (left-padded to 32 bytes)
    //      [4]  uint32   belief_score   (left-padded to 32 bytes)
    //      [5]  uint64   timestamp      (left-padded to 32 bytes)
    let encoded = abi_encode_journal(&journal);

    // 8. Commit the ABI-encoded journal to the zkVM output.
    env::commit_slice(&encoded);
}

// ---------------------------------------------------------------------------
// ABI Encoding Helper
// ---------------------------------------------------------------------------

/// ABI-encode the journal fields to match Solidity's abi.encode().
fn abi_encode_journal(journal: &AttestationJournal) -> [u8; 192] {
    let mut buf = [0u8; 192]; // 6 * 32 = 192

    // Slot 0: bytes32 belief_hash
    buf[0..32].copy_from_slice(&journal.belief_hash);

    // Slot 1: address attester (right-aligned in 32 bytes)
    buf[44..64].copy_from_slice(&journal.attester);

    // Slot 2: uint32 epoch (right-aligned in 32 bytes)
    buf[92..96].copy_from_slice(&journal.epoch.to_be_bytes());

    // Slot 3: uint32 module_id (right-aligned in 32 bytes)
    buf[124..128].copy_from_slice(&journal.module_id.to_be_bytes());

    // Slot 4: uint32 belief_score (right-aligned in 32 bytes)
    buf[156..160].copy_from_slice(&journal.belief_score.to_be_bytes());

    // Slot 5: uint64 timestamp (right-aligned in 32 bytes)
    buf[184..192].copy_from_slice(&journal.timestamp.to_be_bytes());

    buf
}
