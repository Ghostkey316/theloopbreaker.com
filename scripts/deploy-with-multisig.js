const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * Vaultfire V2 Deployment Script with Multi-Sig Governance
 *
 * This script deploys all Vaultfire V2 contracts with multi-sig wallet controls.
 * All admin roles are assigned to Gnosis Safe multi-sig wallets for decentralized governance.
 *
 * Prerequisites:
 * 1. Deploy 3 Gnosis Safe wallets on Base Mainnet (governance, operations, treasury)
 * 2. Fill in multisig addresses in deployment/multisig-config.json
 * 3. Ensure deployer wallet has sufficient ETH for gas
 *
 * Usage:
 *   npx hardhat run scripts/deploy-with-multisig.js --network base
 */

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Vaultfire V2 Deployment with Multi-Sig Governance');
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

  if (balance < ethers.parseEther('0.1')) {
    console.warn('⚠️  Warning: Low deployer balance. Ensure sufficient ETH for gas.\n');
  }

  const deployedContracts = {};
  const deploymentReceipt = [];

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Deploy RewardStream
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
  // 2. Deploy DilithiumAttestor (V2 Launch: Signature-Only Mode)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('Deploying DilithiumAttestor (V2 signature-only mode)...');
  const DilithiumAttestor = await ethers.getContractFactory('DilithiumAttestor');
  const attestor = await DilithiumAttestor.deploy(
    GOVERNANCE_MULTISIG,  // origin (signature authority)
    false,                // zkEnabled (V2 launch: signature-only)
    ethers.ZeroAddress   // verifierAddress (not needed when zkEnabled=false)
  );
  await attestor.waitForDeployment();
  const attestorAddress = await attestor.getAddress();
  deployedContracts.DilithiumAttestor = attestorAddress;

  console.log(`✅ DilithiumAttestor deployed: ${attestorAddress}`);
  console.log(`   Origin Authority: ${GOVERNANCE_MULTISIG}`);
  console.log(`   ZK Enabled: false (signature-only mode for V2 launch)`);
  console.log(`   Verifier Address: ${ethers.ZeroAddress} (not applicable)\n`);

  deploymentReceipt.push({
    name: 'DilithiumAttestor',
    address: attestorAddress,
    roles: { origin: 'governance' },
    config: { zkEnabled: false }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Deploy BeliefOracle
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
  // 4. Deploy V2 Bond Contracts
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
  // 5. Deployment Summary
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Deployment Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📊 Deployment Summary:\n');
  console.log(`Total Contracts Deployed: ${deploymentReceipt.length}`);
  console.log(`Network: ${config.network}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  console.log('Multi-Sig Control Summary:');
  console.log(`  • Governance Multi-Sig: ${GOVERNANCE_MULTISIG}`);
  console.log(`    - Controls: 9 V2 Bond Contracts, DilithiumAttestor, BeliefOracle guardian`);
  console.log(`  • Operations Multi-Sig: ${OPERATIONS_MULTISIG}`);
  console.log(`    - Controls: RewardStream admin, BeliefOracle admin`);
  console.log(`  • Treasury Multi-Sig: ${TREASURY_MULTISIG}`);
  console.log(`    - Controls: Fee recipients, liquidity management\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // 6. Save Deployment Data
  // ═══════════════════════════════════════════════════════════════════════
  const deployment = {
    network: config.network,
    timestamp: new Date().toISOString(),
    deployer: deployerAddress,
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

  const outputPath = path.join(__dirname, '../deployment/deployment-addresses.json');
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));

  console.log(`📄 Deployment addresses saved to: deployment/deployment-addresses.json\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // 7. Post-Deployment Verification
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Post-Deployment Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let verificationErrors = 0;

  // Verify RewardStream roles
  const streamAdmin = await rewardStream.admin();
  const streamGovernor = await rewardStream.governorTimelock();

  console.log('Verifying RewardStream roles...');
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

  // Verify DilithiumAttestor configuration
  const attestorOrigin = await attestor.origin();
  const attestorZkEnabled = await attestor.zkEnabled();

  console.log('\nVerifying DilithiumAttestor configuration...');
  if (attestorOrigin.toLowerCase() !== GOVERNANCE_MULTISIG.toLowerCase()) {
    console.error(`❌ DilithiumAttestor origin mismatch: ${attestorOrigin}`);
    verificationErrors++;
  } else {
    console.log(`✅ DilithiumAttestor origin: ${attestorOrigin}`);
  }

  if (attestorZkEnabled !== false) {
    console.error(`❌ DilithiumAttestor zkEnabled should be false, got: ${attestorZkEnabled}`);
    verificationErrors++;
  } else {
    console.log(`✅ DilithiumAttestor zkEnabled: false (V2 launch mode)`);
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
  // 8. Next Steps
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Next Steps');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('1. ✅ All contracts deployed successfully');
  console.log('2. ✅ All admin roles assigned to multi-sig wallets');
  console.log('3. ⏭️  Verify contracts on BaseScan:');
  console.log('      npx hardhat verify --network base <CONTRACT_ADDRESS>');
  console.log('4. ⏭️  Test multi-sig operations via Gnosis Safe UI:');
  console.log('      https://app.safe.global/');
  console.log('5. ⏭️  Update frontend with deployed contract addresses');
  console.log('6. ⏭️  Publish deployment announcement to community');
  console.log('7. ⏭️  Monitor contracts for 24-48 hours before full launch\n');

  console.log('⚠️  IMPORTANT SECURITY REMINDERS:\n');
  console.log('   • All administrative actions now require multi-sig approval');
  console.log('   • Deployer account has NO control over deployed contracts');
  console.log('   • Use Gnosis Safe UI for all governance operations');
  console.log('   • Test multi-sig workflows with small transactions first');
  console.log('   • Ensure all signers have secure access to their wallets\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Vaultfire V2 is ready for production!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed with error:\n');
    console.error(error);
    process.exit(1);
  });
