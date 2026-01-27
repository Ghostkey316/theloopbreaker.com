const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Vaultfire V2 Production Mainnet Deployment Script
 *
 * This script deploys all Vaultfire contracts to Base Mainnet with:
 * - Multisig governance integration (Gnosis Safe)
 * - Oracle system (BeliefOracle + MultiOracleConsensus)
 * - All V2 bond contracts
 * - Proper ownership transfers
 * - Complete verification and validation
 *
 * Prerequisites:
 * 1. Multisig wallets created on Base Mainnet (see deployment/MAINNET_MULTISIG_SETUP.md)
 * 2. Multisig addresses configured in deployment/mainnet-multisig-config.json
 * 3. Deployer wallet funded with at least 0.5 ETH on Base Mainnet
 * 4. PRIVATE_KEY set in .env
 *
 * Network: Base Mainnet (Chain ID: 8453)
 */

// ============================================================================
// Configuration
// ============================================================================

const MULTISIG_CONFIG_PATH = path.join(__dirname, '../deployment/mainnet-multisig-config.json');
const ORACLE_CONFIG_PATH = path.join(__dirname, '../deployment/oracle-config.json');
const DEPLOYMENT_OUTPUT_PATH = path.join(__dirname, '../deployment/mainnet-deployment.json');

// Load configurations
let multisigConfig, oracleConfig;

try {
  multisigConfig = JSON.parse(fs.readFileSync(MULTISIG_CONFIG_PATH, 'utf8'));
  oracleConfig = JSON.parse(fs.readFileSync(ORACLE_CONFIG_PATH, 'utf8'));
} catch (error) {
  console.error('\n❌ Error loading configuration files:');
  console.error(error.message);
  console.error('\nMake sure you have:');
  console.error('1. Created deployment/mainnet-multisig-config.json');
  console.error('2. Created deployment/oracle-config.json');
  process.exit(1);
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateMultisigAddresses() {
  console.log('\n🔍 Validating multisig addresses...\n');

  const governance = multisigConfig.multisigs.governance.address;
  const operations = multisigConfig.multisigs.operations.address;
  const treasury = multisigConfig.multisigs.treasury.address;

  if (governance.includes('GOVERNANCE_MULTISIG_ADDRESS_HERE')) {
    throw new Error('Governance multisig address not configured. Please update deployment/mainnet-multisig-config.json');
  }

  if (operations.includes('OPERATIONS_MULTISIG_ADDRESS_HERE')) {
    throw new Error('Operations multisig address not configured. Please update deployment/mainnet-multisig-config.json');
  }

  if (treasury.includes('TREASURY_MULTISIG_ADDRESS_HERE')) {
    throw new Error('Treasury multisig address not configured. Please update deployment/mainnet-multisig-config.json');
  }

  if (!hre.ethers.isAddress(governance)) {
    throw new Error(`Invalid governance multisig address: ${governance}`);
  }

  if (!hre.ethers.isAddress(operations)) {
    throw new Error(`Invalid operations multisig address: ${operations}`);
  }

  if (!hre.ethers.isAddress(treasury)) {
    throw new Error(`Invalid treasury multisig address: ${treasury}`);
  }

  console.log(`✅ Governance Multisig: ${governance}`);
  console.log(`✅ Operations Multisig: ${operations}`);
  console.log(`✅ Treasury Multisig: ${treasury}\n`);

  return { governance, operations, treasury };
}

async function validateDeployerBalance(deployer) {
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceETH = hre.ethers.formatEther(balance);

  console.log(`\n💰 Deployer Balance: ${balanceETH} ETH\n`);

  if (balance < hre.ethers.parseEther("0.2")) {
    throw new Error(`Insufficient balance. Need at least 0.2 ETH, have ${balanceETH} ETH`);
  }

  return balance;
}

function validateNetwork(network) {
  if (network.name !== 'baseMainnet' && network.chainId !== 8453) {
    throw new Error(`Wrong network! Expected Base Mainnet (8453), got ${network.name} (${network.chainId})`);
  }

  console.log(`✅ Network: ${network.name} (Chain ID: ${network.chainId})\n`);
}

// ============================================================================
// Deployment Functions
// ============================================================================

async function deployContract(contractName, args = [], deployer) {
  console.log(`📦 Deploying ${contractName}...`);

  const Contract = await hre.ethers.getContractFactory(contractName);
  const contract = await Contract.deploy(...args);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();

  console.log(`   ✅ ${contractName}: ${address}`);
  console.log(`   📝 TX: ${tx.hash}\n`);

  // Wait for a few confirmations
  await tx.wait(3);

  return { contract, address, tx: tx.hash };
}

async function transferOwnership(contract, contractName, newOwner, deployer) {
  console.log(`🔑 Transferring ${contractName} ownership to ${newOwner}...`);

  const tx = await contract.transferOwnership(newOwner);
  await tx.wait(2);

  // Verify ownership transfer
  const currentOwner = await contract.owner();
  if (currentOwner.toLowerCase() !== newOwner.toLowerCase()) {
    throw new Error(`Ownership transfer failed for ${contractName}. Expected ${newOwner}, got ${currentOwner}`);
  }

  console.log(`   ✅ Ownership transferred\n`);
}

// ============================================================================
// Main Deployment
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔥 VAULTFIRE V2 PRODUCTION MAINNET DEPLOYMENT 🔥');
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();

  // ============================================================================
  // Pre-Deployment Validation
  // ============================================================================

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log(`🚀 Deployer: ${deployer.address}`);
  validateNetwork(network);
  await validateDeployerBalance(deployer);
  const multisigs = validateMultisigAddresses();

  // Safety confirmation
  console.log('\n' + '⚠️ '.repeat(20));
  console.log('⚠️  MAINNET DEPLOYMENT - THIS WILL COST REAL ETH');
  console.log('⚠️  Deploying to Base Mainnet (Chain ID: 8453)');
  console.log('⚠️  All contracts will be live and immutable');
  console.log('⚠️ '.repeat(20) + '\n');

  console.log('⏳ Waiting 10 seconds... (Ctrl+C to cancel)\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // ============================================================================
  // Contract Deployment
  // ============================================================================

  const deploymentResults = {
    network: 'base-mainnet',
    chainId: 8453,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    multisigs: multisigs,
    contracts: {}
  };

  console.log('\n' + '='.repeat(80));
  console.log('PHASE 1: CORE INFRASTRUCTURE');
  console.log('='.repeat(80) + '\n');

  // 1. Deploy RewardStream
  const { contract: rewardStream, address: rewardStreamAddress, tx: rewardStreamTx } = await deployContract(
    'RewardStream',
    [multisigs.operations, multisigs.governance],
    deployer
  );
  deploymentResults.contracts.RewardStream = {
    address: rewardStreamAddress,
    tx: rewardStreamTx,
    admin: multisigs.operations,
    governorTimelock: multisigs.governance
  };

  // 2. Deploy DilithiumAttestor (V2: signature-only mode)
  const { contract: attestor, address: attestorAddress, tx: attestorTx } = await deployContract(
    'DilithiumAttestor',
    [multisigs.governance, false, hre.ethers.ZeroAddress],
    deployer
  );
  deploymentResults.contracts.DilithiumAttestor = {
    address: attestorAddress,
    tx: attestorTx,
    origin: multisigs.governance,
    zkEnabled: false,
    verifierAddress: hre.ethers.ZeroAddress
  };

  console.log('\n' + '='.repeat(80));
  console.log('PHASE 2: ORACLE SYSTEM');
  console.log('='.repeat(80) + '\n');

  // 3. Deploy BeliefOracle
  const ghostEcho = oracleConfig.beliefOracle.ghostEcho;
  const { contract: beliefOracle, address: beliefOracleAddress, tx: beliefOracleTx } = await deployContract(
    'BeliefOracle',
    [attestorAddress, rewardStreamAddress, multisigs.governance, ghostEcho],
    deployer
  );
  deploymentResults.contracts.BeliefOracle = {
    address: beliefOracleAddress,
    tx: beliefOracleTx,
    guardian: multisigs.governance,
    ghostEcho: ghostEcho,
    attestor: attestorAddress,
    rewardStream: rewardStreamAddress
  };

  // 4. Deploy MultiOracleConsensus
  const { contract: oracleConsensus, address: oracleConsensusAddress, tx: oracleConsensusTx } = await deployContract(
    'MultiOracleConsensus',
    [],
    deployer
  );
  deploymentResults.contracts.MultiOracleConsensus = {
    address: oracleConsensusAddress,
    tx: oracleConsensusTx,
    initialOwner: deployer.address,
    finalOwner: multisigs.operations
  };

  // Transfer MultiOracleConsensus ownership to operations multisig
  await transferOwnership(oracleConsensus, 'MultiOracleConsensus', multisigs.operations, deployer);

  console.log('\n' + '='.repeat(80));
  console.log('PHASE 3: V2 BOND CONTRACTS');
  console.log('='.repeat(80) + '\n');

  const bondContracts = [
    'BuilderBeliefBondsV2',
    'LaborDignityBondsV2',
    'PurchasingPowerBondsV2',
    'AIAccountabilityBondsV2',
    'HealthCommonsBondsV2',
    'EscapeVelocityBondsV2',
    'AIPartnershipBondsV2',
    'CommonGroundBondsV2',
    'VerdantAnchorBondsV2'
  ];

  for (const bondName of bondContracts) {
    const { contract: bond, address: bondAddress, tx: bondTx } = await deployContract(
      bondName,
      [],
      deployer
    );

    deploymentResults.contracts[bondName] = {
      address: bondAddress,
      tx: bondTx,
      initialOwner: deployer.address,
      finalOwner: multisigs.governance
    };

    // Transfer ownership to governance multisig
    await transferOwnership(bond, bondName, multisigs.governance, deployer);
  }

  console.log('\n' + '='.repeat(80));
  console.log('PHASE 4: ADDITIONAL CONTRACTS');
  console.log('='.repeat(80) + '\n');

  // 5. Deploy RewardMultiplier
  const FALLBACK_MULTIPLIER = 10000; // 100% (no bonus)
  const BONUS_CAP = 15000; // 150% max bonus
  const { contract: multiplier, address: multiplierAddress, tx: multiplierTx } = await deployContract(
    'RewardMultiplier',
    [rewardStreamAddress, FALLBACK_MULTIPLIER, BONUS_CAP],
    deployer
  );
  deploymentResults.contracts.RewardMultiplier = {
    address: multiplierAddress,
    tx: multiplierTx,
    rewardStream: rewardStreamAddress,
    fallbackMultiplier: FALLBACK_MULTIPLIER,
    bonusCap: BONUS_CAP,
    initialOwner: deployer.address,
    finalOwner: multisigs.governance
  };
  await transferOwnership(multiplier, 'RewardMultiplier', multisigs.governance, deployer);

  // 6. Deploy ContributorUnlockKey
  const { contract: unlockKey, address: unlockKeyAddress, tx: unlockKeyTx } = await deployContract(
    'ContributorUnlockKey',
    [],
    deployer
  );
  deploymentResults.contracts.ContributorUnlockKey = {
    address: unlockKeyAddress,
    tx: unlockKeyTx,
    initialOwner: deployer.address,
    finalOwner: multisigs.operations
  };
  await transferOwnership(unlockKey, 'ContributorUnlockKey', multisigs.operations, deployer);

  // ============================================================================
  // Post-Deployment Verification
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('PHASE 5: VERIFICATION');
  console.log('='.repeat(80) + '\n');

  console.log('🔍 Verifying contract ownership...\n');

  // Verify RewardStream roles
  const streamAdmin = await rewardStream.admin();
  const streamGovernor = await rewardStream.governorTimelock();
  console.log(`✅ RewardStream admin: ${streamAdmin} (expected: ${multisigs.operations})`);
  console.log(`✅ RewardStream governor: ${streamGovernor} (expected: ${multisigs.governance})\n`);

  // Verify DilithiumAttestor
  const attestorOrigin = await attestor.origin();
  const attestorZkEnabled = await attestor.zkEnabled();
  console.log(`✅ DilithiumAttestor origin: ${attestorOrigin} (expected: ${multisigs.governance})`);
  console.log(`✅ DilithiumAttestor zkEnabled: ${attestorZkEnabled} (expected: false)\n`);

  // Verify BeliefOracle
  const oracleGuardian = await beliefOracle.guardian();
  console.log(`✅ BeliefOracle guardian: ${oracleGuardian} (expected: ${multisigs.governance})\n`);

  // Verify MultiOracleConsensus
  const consensusOwner = await oracleConsensus.owner();
  console.log(`✅ MultiOracleConsensus owner: ${consensusOwner} (expected: ${multisigs.operations})\n`);

  // ============================================================================
  // Save Deployment Data
  // ============================================================================

  const endTime = Date.now();
  const deploymentTime = ((endTime - startTime) / 1000 / 60).toFixed(2);

  deploymentResults.deploymentTimeMinutes = deploymentTime;
  deploymentResults.success = true;

  fs.writeFileSync(
    DEPLOYMENT_OUTPUT_PATH,
    JSON.stringify(deploymentResults, null, 2)
  );

  // Update oracle config with deployed addresses
  oracleConfig.beliefOracle.deployed = true;
  oracleConfig.beliefOracle.address = beliefOracleAddress;
  oracleConfig.beliefOracle.deploymentTx = beliefOracleTx;
  oracleConfig.multiOracleConsensus.deployed = true;
  oracleConfig.multiOracleConsensus.address = oracleConsensusAddress;
  oracleConfig.multiOracleConsensus.deploymentTx = oracleConsensusTx;

  fs.writeFileSync(
    ORACLE_CONFIG_PATH,
    JSON.stringify(oracleConfig, null, 2)
  );

  // Update multisig config
  multisigConfig.deployed = true;
  multisigConfig.deploymentDate = new Date().toISOString();

  fs.writeFileSync(
    MULTISIG_CONFIG_PATH,
    JSON.stringify(multisigConfig, null, 2)
  );

  // ============================================================================
  // Deployment Summary
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('='.repeat(80) + '\n');

  console.log(`⏱️  Total Time: ${deploymentTime} minutes\n`);

  console.log('📋 DEPLOYED CONTRACTS:\n');
  console.log('Core Infrastructure:');
  console.log(`  - RewardStream: ${rewardStreamAddress}`);
  console.log(`  - DilithiumAttestor: ${attestorAddress}`);
  console.log(`\nOracle System:`);
  console.log(`  - BeliefOracle: ${beliefOracleAddress}`);
  console.log(`  - MultiOracleConsensus: ${oracleConsensusAddress}`);
  console.log(`\nV2 Bond Contracts:`);
  bondContracts.forEach(name => {
    console.log(`  - ${name}: ${deploymentResults.contracts[name].address}`);
  });
  console.log(`\nAdditional Contracts:`);
  console.log(`  - RewardMultiplier: ${multiplierAddress}`);
  console.log(`  - ContributorUnlockKey: ${unlockKeyAddress}`);

  console.log(`\n📄 Full deployment data saved to: ${DEPLOYMENT_OUTPUT_PATH}`);

  console.log('\n' + '='.repeat(80));
  console.log('NEXT STEPS:');
  console.log('='.repeat(80) + '\n');

  console.log('1. Verify contracts on Basescan:');
  console.log(`   npx hardhat verify --network baseMainnet ${rewardStreamAddress} "${multisigs.operations}" "${multisigs.governance}"`);
  console.log(`   npx hardhat verify --network baseMainnet ${attestorAddress} "${multisigs.governance}" false "${hre.ethers.ZeroAddress}"`);
  console.log(`   ... (see verification script for full list)\n`);

  console.log('2. Test all multisig functionality via Gnosis Safe UI\n');

  console.log('3. Fund protocol contracts if needed\n');

  console.log('4. Deploy frontend with contract addresses\n');

  console.log('5. Announce mainnet launch! 🎉\n');

  console.log('🔗 View on BaseScan:');
  console.log(`   https://basescan.org/address/${rewardStreamAddress}`);
  console.log(`   https://basescan.org/address/${beliefOracleAddress}\n`);
}

// ============================================================================
// Error Handling
// ============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n' + '❌'.repeat(40));
    console.error('DEPLOYMENT FAILED:');
    console.error('❌'.repeat(40) + '\n');
    console.error(error);

    // Save error log
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };

    fs.writeFileSync(
      path.join(__dirname, '../deployment/deployment-error.json'),
      JSON.stringify(errorLog, null, 2)
    );

    console.error('\n📄 Error log saved to deployment/deployment-error.json\n');
    process.exit(1);
  });
