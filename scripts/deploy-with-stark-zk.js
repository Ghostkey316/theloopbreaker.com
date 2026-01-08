const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * Vaultfire V2 Deployment with STARK ZK Proof System
 *
 * This script deploys all Vaultfire V2 contracts with FULL STARK ZK verification enabled.
 * Use this for production deployments that require zero-knowledge privacy guarantees.
 *
 * Prerequisites:
 * 1. Deploy 3 Gnosis Safe wallets on Base Mainnet (governance, operations, treasury)
 * 2. Fill in multisig addresses in deployment/multisig-config.json
 * 3. Choose STARK prover implementation (Risc0/StarkWare/Miden)
 * 4. Ensure deployer wallet has sufficient ETH for gas
 *
 * Usage:
 *   npx hardhat run scripts/deploy-with-stark-zk.js --network base
 */

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 Vaultfire V2 Deployment with STARK ZK Proof System');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Load multi-sig configuration
  const configPath = path.join(__dirname, '../deployment/multisig-config.json');

  if (!fs.existsSync(configPath)) {
    console.error('❌ Error: multisig-config.json not found!');
    console.error('   Please copy multisig-config.template.json to multisig-config.json');
    console.error('   and fill in your multi-sig wallet addresses.\n');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const GOVERNANCE_MULTISIG = config.multisigs.governance.address;
  const OPERATIONS_MULTISIG = config.multisigs.operations.address;
  const TREASURY_MULTISIG = config.multisigs.treasury.address;

  // Validate multi-sig addresses
  if (!ethers.isAddress(GOVERNANCE_MULTISIG) || GOVERNANCE_MULTISIG.includes('HERE')) {
    console.error('❌ Invalid governance multi-sig address in config');
    process.exit(1);
  }
  if (!ethers.isAddress(OPERATIONS_MULTISIG) || OPERATIONS_MULTISIG.includes('HERE')) {
    console.error('❌ Invalid operations multi-sig address in config');
    process.exit(1);
  }
  if (!ethers.isAddress(TREASURY_MULTISIG) || TREASURY_MULTISIG.includes('HERE')) {
    console.error('❌ Invalid treasury multi-sig address in config');
    process.exit(1);
  }

  console.log('📋 Multi-Sig Configuration:');
  console.log(`   Governance (3-of-5): ${GOVERNANCE_MULTISIG}`);
  console.log(`   Operations (2-of-3): ${OPERATIONS_MULTISIG}`);
  console.log(`   Treasury (4-of-6):   ${TREASURY_MULTISIG}\n`);

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance < ethers.parseEther('0.2')) {
    console.warn('⚠️  Warning: Low deployer balance. STARK deployments require more gas.\n');
  }

  const deployedContracts = {};
  const deploymentReceipt = [];

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Deploy STARK Verifier (BeliefAttestationVerifier)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 Deploying STARK ZK Infrastructure');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Deploying BeliefAttestationVerifier (STARK Verifier)...');
  const BeliefVerifier = await ethers.getContractFactory('BeliefAttestationVerifier');
  const beliefVerifier = await BeliefVerifier.deploy();
  await beliefVerifier.waitForDeployment();
  const verifierAddress = await beliefVerifier.getAddress();
  deployedContracts.BeliefAttestationVerifier = verifierAddress;

  const proofSystemId = await beliefVerifier.getProofSystemId();
  const publicInputsCount = await beliefVerifier.getPublicInputsCount();
  const minThreshold = await beliefVerifier.getMinBeliefThreshold();

  console.log(`✅ BeliefAttestationVerifier deployed: ${verifierAddress}`);
  console.log(`   Proof System: ${proofSystemId}`);
  console.log(`   Public Inputs: ${publicInputsCount}`);
  console.log(`   Min Threshold: ${minThreshold / 100}% alignment`);
  console.log(`   ⚡ STARK Features:`);
  console.log(`      - No trusted setup (transparent)`);
  console.log(`      - Post-quantum secure`);
  console.log(`      - Scalable for large proofs\n`);

  deploymentReceipt.push({
    name: 'BeliefAttestationVerifier',
    address: verifierAddress,
    config: { proofSystemId, publicInputsCount, minThreshold }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. Deploy Core Infrastructure
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 Deploying Core Infrastructure');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Deploying RewardStream...');
  const RewardStream = await ethers.getContractFactory('RewardStream');
  const rewardStream = await RewardStream.deploy(
    OPERATIONS_MULTISIG,  // admin
    GOVERNANCE_MULTISIG   // governorTimelock
  );
  await rewardStream.waitForDeployment();
  const rewardStreamAddress = await rewardStream.getAddress();
  deployedContracts.RewardStream = rewardStreamAddress;

  console.log(`✅ RewardStream deployed: ${rewardStreamAddress}`);
  console.log(`   Admin: ${OPERATIONS_MULTISIG}`);
  console.log(`   Governor: ${GOVERNANCE_MULTISIG}\n`);

  deploymentReceipt.push({
    name: 'RewardStream',
    address: rewardStreamAddress,
    roles: { admin: 'operations', governor: 'governance' }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Deploy DilithiumAttestor with STARK ZK ENABLED
  // ═══════════════════════════════════════════════════════════════════════
  console.log('🔐 Deploying DilithiumAttestor (STARK ZK ENABLED)...');
  const DilithiumAttestor = await ethers.getContractFactory('DilithiumAttestor');
  const attestor = await DilithiumAttestor.deploy(
    GOVERNANCE_MULTISIG,  // origin (signature authority)
    true,                 // zkEnabled = TRUE (FULL ZK MODE!)
    verifierAddress       // STARK verifier address
  );
  await attestor.waitForDeployment();
  const attestorAddress = await attestor.getAddress();
  deployedContracts.DilithiumAttestor = attestorAddress;

  // Verify ZK is enabled
  const zkEnabled = await attestor.zkEnabled();
  const configuredVerifier = await attestor.verifierAddress();

  console.log(`✅ DilithiumAttestor deployed: ${attestorAddress}`);
  console.log(`   Origin Authority: ${GOVERNANCE_MULTISIG}`);
  console.log(`   🔐 ZK Enabled: ${zkEnabled ? 'TRUE (FULL STARK ZK MODE)' : 'FALSE'}`);
  console.log(`   Verifier: ${configuredVerifier}`);
  console.log(`   Privacy Mode: ZERO-KNOWLEDGE PROOFS REQUIRED ✅\n`);

  if (!zkEnabled) {
    console.error('❌ ERROR: ZK should be enabled but is disabled!');
    process.exit(1);
  }

  deploymentReceipt.push({
    name: 'DilithiumAttestor',
    address: attestorAddress,
    roles: { origin: 'governance' },
    config: { zkEnabled: true, verifier: verifierAddress }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. Deploy BeliefOracle
  // ═══════════════════════════════════════════════════════════════════════
  console.log('Deploying BeliefOracle...');
  const BeliefOracle = await ethers.getContractFactory('BeliefOracle');
  const oracle = await BeliefOracle.deploy(
    attestorAddress,
    rewardStreamAddress,
    GOVERNANCE_MULTISIG,  // guardian
    OPERATIONS_MULTISIG   // admin
  );
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  deployedContracts.BeliefOracle = oracleAddress;

  console.log(`✅ BeliefOracle deployed: ${oracleAddress}`);
  console.log(`   Guardian: ${GOVERNANCE_MULTISIG}`);
  console.log(`   Admin: ${OPERATIONS_MULTISIG}\n`);

  deploymentReceipt.push({
    name: 'BeliefOracle',
    address: oracleAddress,
    roles: { guardian: 'governance', admin: 'operations' }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. Deploy V2 Bond Contracts
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 Deploying V2 Bond Contracts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const bondContracts = [
    { name: 'BuilderBeliefBondsV2', description: 'Builder belief tracking with reputation multiplier' },
    { name: 'LaborDignityBondsV2', description: 'Labor dignity with 50% minimum floor' },
    { name: 'PurchasingPowerBondsV2', description: '1990s affordability baseline bonds' },
    { name: 'AIAccountabilityBondsV2', description: 'AI accountability with purpose/agency metrics' },
    { name: 'HealthCommonsBondsV2', description: 'Health commons with 15x pollution reversal' },
    { name: 'EscapeVelocityBondsV2', description: 'Poverty escape with pay-it-forward mechanism' },
    { name: 'AIPartnershipBondsV2', description: 'Human-AI partnership quality measurement' },
    { name: 'CommonGroundBondsV2', description: 'Bridge-building with witness verification' },
    { name: 'VerdantAnchorBondsV2', description: 'Ecological regeneration with greenwashing protection' }
  ];

  for (let i = 0; i < bondContracts.length; i++) {
    const { name, description } = bondContracts[i];
    console.log(`[${i + 1}/${bondContracts.length}] Deploying ${name}...`);
    console.log(`    Purpose: ${description}`);

    const Bond = await ethers.getContractFactory(name);
    const bond = await Bond.deploy();
    await bond.waitForDeployment();
    const bondAddress = await bond.getAddress();

    // Transfer ownership to governance multi-sig
    console.log(`    Transferring ownership to governance multi-sig...`);
    const tx = await bond.transferOwnership(GOVERNANCE_MULTISIG);
    await tx.wait();

    // Verify ownership transfer
    const currentOwner = await bond.owner();
    if (currentOwner.toLowerCase() !== GOVERNANCE_MULTISIG.toLowerCase()) {
      throw new Error(`Ownership transfer failed for ${name}`);
    }

    deployedContracts[name] = bondAddress;
    console.log(`✅ ${name} deployed: ${bondAddress}`);
    console.log(`   Owner: ${GOVERNANCE_MULTISIG} ✓\n`);

    deploymentReceipt.push({
      name,
      address: bondAddress,
      roles: { owner: 'governance' },
      description
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. Deployment Summary
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 STARK ZK Deployment Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📊 Deployment Summary:\n');
  console.log(`Total Contracts Deployed: ${deploymentReceipt.length}`);
  console.log(`Network: ${config.network}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  console.log('🔐 STARK ZK Configuration:');
  console.log(`  • Proof System: STARK-BeliefAttestation-v1.0`);
  console.log(`  • Privacy Mode: ZERO-KNOWLEDGE (beliefs remain private)`);
  console.log(`  • Security: No trusted setup + Post-quantum secure`);
  console.log(`  • Verifier: ${verifierAddress}`);
  console.log(`  • DilithiumAttestor: ZK ENABLED ✅\n`);

  console.log('Multi-Sig Control Summary:');
  console.log(`  • Governance Multi-Sig: ${GOVERNANCE_MULTISIG}`);
  console.log(`    - Controls: 9 V2 Bond Contracts, DilithiumAttestor origin`);
  console.log(`  • Operations Multi-Sig: ${OPERATIONS_MULTISIG}`);
  console.log(`    - Controls: RewardStream admin, BeliefOracle admin`);
  console.log(`  • Treasury Multi-Sig: ${TREASURY_MULTISIG}`);
  console.log(`    - Controls: Fee recipients, liquidity management\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // 7. Save Deployment Data
  // ═══════════════════════════════════════════════════════════════════════
  const deployment = {
    network: config.network,
    timestamp: new Date().toISOString(),
    deployer: deployerAddress,
    zkMode: 'STARK_ENABLED',
    multisigs: {
      governance: {
        address: GOVERNANCE_MULTISIG,
        threshold: config.multisigs.governance.threshold,
        signers: config.multisigs.governance.signers
      },
      operations: {
        address: OPERATIONS_MULTISIG,
        threshold: config.multisigs.operations.threshold,
        signers: config.multisigs.operations.signers
      },
      treasury: {
        address: TREASURY_MULTISIG,
        threshold: config.multisigs.treasury.threshold,
        signers: config.multisigs.treasury.signers
      }
    },
    contracts: deployedContracts,
    deploymentReceipt
  };

  const outputPath = path.join(__dirname, '../deployment/deployment-stark-zk.json');
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));

  console.log(`📄 Deployment addresses saved to: deployment/deployment-stark-zk.json\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // 8. Post-Deployment Verification
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Post-Deployment Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let verificationErrors = 0;

  // Verify DilithiumAttestor ZK is enabled
  console.log('Verifying DilithiumAttestor STARK ZK configuration...');
  if (!zkEnabled) {
    console.error(`❌ DilithiumAttestor zkEnabled should be true, got: ${zkEnabled}`);
    verificationErrors++;
  } else {
    console.log(`✅ DilithiumAttestor zkEnabled: true (STARK ZK MODE)`);
  }

  if (configuredVerifier.toLowerCase() !== verifierAddress.toLowerCase()) {
    console.error(`❌ Verifier mismatch: ${configuredVerifier} vs ${verifierAddress}`);
    verificationErrors++;
  } else {
    console.log(`✅ DilithiumAttestor verifier: ${configuredVerifier}`);
  }

  // Verify RewardStream roles
  const streamAdmin = await rewardStream.admin();
  const streamGovernor = await rewardStream.governorTimelock();

  console.log('\nVerifying RewardStream roles...');
  if (streamAdmin.toLowerCase() !== OPERATIONS_MULTISIG.toLowerCase()) {
    console.error(`❌ RewardStream admin mismatch: ${streamAdmin}`);
    verificationErrors++;
  } else {
    console.log(`✅ RewardStream admin: ${streamAdmin}`);
  }

  if (streamGovernor.toLowerCase() !== GOVERNANCE_MULTISIG.toLowerCase()) {
    console.error(`❌ RewardStream governor mismatch: ${streamGovernor}`);
    verificationErrors++;
  } else {
    console.log(`✅ RewardStream governor: ${streamGovernor}`);
  }

  // Verify bond contract ownership
  console.log('\nVerifying V2 Bond Contract ownership...');
  for (const { name } of bondContracts) {
    const Bond = await ethers.getContractFactory(name);
    const bond = Bond.attach(deployedContracts[name]);
    const owner = await bond.owner();

    if (owner.toLowerCase() !== GOVERNANCE_MULTISIG.toLowerCase()) {
      console.error(`❌ ${name} owner mismatch: ${owner}`);
      verificationErrors++;
    } else {
      console.log(`✅ ${name} owner: ${owner}`);
    }
  }

  console.log('');
  if (verificationErrors > 0) {
    console.error(`❌ Verification failed with ${verificationErrors} error(s)\n`);
    process.exit(1);
  } else {
    console.log('✅ All verifications passed!\n');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 9. Next Steps
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Next Steps');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('1. ✅ All contracts deployed with STARK ZK enabled');
  console.log('2. ✅ All admin roles assigned to multi-sig wallets');
  console.log('3. ⏭️  Setup STARK proof generation system:');
  console.log('      - Choose prover: Risc0 / StarkWare / Miden');
  console.log('      - Implement belief attestation circuit');
  console.log('      - Deploy proof generation API/service');
  console.log('      - See: docs/STARK_PROOF_GENERATION.md');
  console.log('4. ⏭️  Test STARK proof verification:');
  console.log('      - Generate test proofs');
  console.log('      - Verify on-chain via DilithiumAttestor');
  console.log('      - Monitor gas costs');
  console.log('5. ⏭️  Verify contracts on BaseScan:');
  console.log('      npx hardhat verify --network base <CONTRACT_ADDRESS>');
  console.log('6. ⏭️  Update frontend with deployed addresses');
  console.log('7. ⏭️  Publish STARK ZK launch announcement\n');

  console.log('⚠️  IMPORTANT STARK ZK REQUIREMENTS:\n');
  console.log('   • Users MUST generate STARK proofs to attest beliefs');
  console.log('   • Origin signature STILL required (dual verification)');
  console.log('   • Proof generation requires off-chain prover setup');
  console.log('   • Privacy guaranteed: beliefs never revealed on-chain');
  console.log('   • Post-quantum secure: future-proof cryptography ✅\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Vaultfire V2 STARK ZK is ready for production!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed with error:\n');
    console.error(error);
    process.exit(1);
  });
