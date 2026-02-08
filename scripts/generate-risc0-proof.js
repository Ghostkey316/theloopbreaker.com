/**
 * RISC Zero Proof Generation Script for Vaultfire Belief Attestation
 *
 * This script generates REAL STARK proofs using the Rust RISC Zero host prover.
 *
 * Usage:
 *   node scripts/generate-risc0-proof.js <beliefMessage> <loyaltyProof> <loyaltyScore>
 *
 * Example:
 *   node scripts/generate-risc0-proof.js "Vaultfire protects human agency" "github:abc123" 9500
 */

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { keccak256, toUtf8Bytes, AbiCoder } = require('ethers');

const abi = AbiCoder.defaultAbiCoder();

function bigIntFromHex32(hex32) {
  const h = hex32.startsWith('0x') ? hex32 : '0x' + hex32;
  return BigInt(h);
}

/**
 * Generate a RISC Zero STARK proof for belief attestation
 *
 * @param {Object} params
 * @returns {Promise<{ proofBytes: string, publicInputs: string[], journalDigest: string, imageId?: string, raw?: any }>}
 */
async function generateRisc0Proof(params) {
  const repoRoot = path.join(__dirname, '..');
  const tmpDir = path.join(repoRoot, 'proofs', 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  // Compute belief hash (keccak256 to match Solidity + guest)
  const beliefHashHex = keccak256(toUtf8Bytes(params.beliefMessage));

  // Prepare input JSON expected by risc0-prover/host
  const inputData = {
    belief_message: params.beliefMessage,
    signature: params.signature,
    loyalty_proof: params.loyaltyProof,
    loyalty_score: params.loyaltyScore,
    prover_address: params.proverAddress,
    epoch: params.epoch,
    module_id: params.moduleId,
  };

  const inputPath = path.join(tmpDir, `risc0-input-${Date.now()}.json`);
  const outputPath = path.join(tmpDir, `risc0-proof-${Date.now()}.json`);
  fs.writeFileSync(inputPath, JSON.stringify(inputData, null, 2));

  // Invoke the Rust prover (real STARK proof)
  // NOTE: requires Rust toolchain installed.
  const cargoArgs = [
    'run',
    '--release',
    '--manifest-path',
    path.join(repoRoot, 'risc0-prover', 'host', 'Cargo.toml'),
    '--',
    'prove',
    '--input',
    inputPath,
    '--output',
    outputPath,
  ];

  execFileSync('cargo', cargoArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  const proofJson = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  // proof_bytes is hex (no 0x) from Rust host
  const proofBytes = '0x' + proofJson.proof_bytes;

  // Solidity publicInputs: uint256[]
  const publicInputs = [
    bigIntFromHex32(beliefHashHex).toString(),
    BigInt(params.proverAddress).toString(),
    params.epoch.toString(),
    params.moduleId.toString(),
  ];

  // journalDigest must match contract computation
  const journalDigest = keccak256(
    abi.encode(
      ['bytes32', 'address', 'uint256', 'uint256'],
      [beliefHashHex, params.proverAddress, BigInt(params.epoch), BigInt(params.moduleId)]
    )
  );

  return {
    proofBytes,
    publicInputs,
    journalDigest,
    imageId: proofJson.image_id ? '0x' + proofJson.image_id : undefined,
    raw: proofJson,
  };
}

// ============================================
// CLI Interface
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Usage: node scripts/generate-risc0-proof.js <beliefMessage> <loyaltyProof> <loyaltyScore>');
    console.log('\nExample:');
    console.log('  node scripts/generate-risc0-proof.js "Vaultfire protects human agency" "github:abc123" 9500');
    console.log('\nLoyalty Proof Formats:');
    console.log('  - GitHub: "github:<commit_sha>"');
    console.log('  - NS3: "ns3:<session_id>"');
    console.log('  - Base: "base:<tx_hash>"');
    process.exit(1);
  }

  const [beliefMessage, loyaltyProof, loyaltyScoreStr] = args;
  const loyaltyScore = parseInt(loyaltyScoreStr, 10);

  if (Number.isNaN(loyaltyScore) || loyaltyScore < 0 || loyaltyScore > 10000) {
    console.error('❌ Loyalty score must be between 0 and 10000 (0-100.00%)');
    process.exit(1);
  }

  // Determine module ID from loyalty proof
  let moduleId = 0;
  if (loyaltyProof.startsWith('github:')) moduleId = 1;
  else if (loyaltyProof.startsWith('ns3:')) moduleId = 2;
  else if (loyaltyProof.startsWith('base:')) moduleId = 3;

  // Mock signature (in production, get from user's wallet)
  const mockSignature = '0x' + crypto.randomBytes(65).toString('hex');

  // Mock prover address (in production, get from user's wallet)
  const mockProverAddress = '0x' + crypto.randomBytes(20).toString('hex');

  const proof = await generateRisc0Proof({
    beliefMessage,
    signature: mockSignature,
    loyaltyProof,
    loyaltyScore,
    proverAddress: mockProverAddress,
    epoch: 0,
    moduleId,
  });

  console.log('\n📋 Proof Details (for Solidity):');
  console.log('  - proofBytes:', proof.proofBytes);
  console.log('  - publicInputs:', JSON.stringify(proof.publicInputs, null, 2));
  console.log('  - journalDigest:', proof.journalDigest);
  if (proof.imageId) console.log('  - imageId:', proof.imageId);
  console.log('\n✅ Proof generation complete!');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { generateRisc0Proof };
