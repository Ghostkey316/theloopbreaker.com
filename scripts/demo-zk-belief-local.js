// One-command local demo for the ZK belief attestation wiring.
//
// Usage:
//   node scripts/demo-zk-belief-local.js "Vaultfire protects human agency" "github:abc123" 9500

const { execSync } = require('child_process');
const path = require('path');

async function main() {
  const [beliefMessage, loyaltyProof, loyaltyScore] = process.argv.slice(2);
  if (!beliefMessage || !loyaltyProof || !loyaltyScore) {
    console.log('Usage: node scripts/demo-zk-belief-local.js <beliefMessage> <loyaltyProof> <loyaltyScore>');
    process.exit(1);
  }

  console.log('\n[1/2] Generate a real proof (writes proofs/tmp/risc0-proof-latest.json)');
  execSync(
    `node ${path.join(__dirname, 'generate-risc0-proof.js')} "${beliefMessage}" "${loyaltyProof}" ${loyaltyScore}`,
    { cwd: path.join(__dirname, '..'), stdio: 'inherit' }
  );

  console.log('\n[2/2] Verify the digest binding on-chain (local Hardhat)');
  execSync(`npx hardhat test test/Risc0BeliefAttestationProduction.test.js`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
}

main().catch((e) => {
  console.error('Demo failed:', e);
  process.exit(1);
});
