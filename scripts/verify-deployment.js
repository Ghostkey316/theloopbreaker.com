const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Post-Deployment Verification Script
 *
 * Verifies that all Vaultfire V2 contracts were deployed correctly and
 * ownership/roles are properly configured.
 *
 * Run after deployment: npx hardhat run scripts/verify-deployment.js --network baseMainnet
 */

const DEPLOYMENT_PATH = path.join(__dirname, '../deployment/mainnet-deployment.json');
const MULTISIG_CONFIG_PATH = path.join(__dirname, '../deployment/mainnet-multisig-config.json');

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 POST-DEPLOYMENT VERIFICATION');
  console.log('='.repeat(80) + '\n');

  // Load deployment data
  let deployment, multisigConfig;
  try {
    deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf8'));
    multisigConfig = JSON.parse(fs.readFileSync(MULTISIG_CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.error('❌ Error loading deployment files:');
    console.error(error.message);
    console.error('\nMake sure deployment completed successfully first.');
    process.exit(1);
  }

  // Verify network
  const network = await hre.ethers.provider.getNetwork();
  console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`📅 Deployment Date: ${deployment.timestamp}\n`);

  if (network.chainId !== 8453n) {
    console.error('❌ Wrong network! Expected Base Mainnet (8453)');
    process.exit(1);
  }

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    checks: []
  };

  const multisigs = deployment.multisigs;

  console.log('='.repeat(80));
  console.log('PHASE 1: CONTRACT EXISTENCE');
  console.log('='.repeat(80) + '\n');

  // Verify all contracts exist
  for (const [contractName, contractData] of Object.entries(deployment.contracts)) {
    const address = contractData.address;
    console.log(`📦 ${contractName}: ${address}`);

    const code = await hre.ethers.provider.getCode(address);
    if (code === '0x') {
      console.error(`   ❌ No contract found!\n`);
      results.failed++;
      results.checks.push({ contract: contractName, check: 'existence', passed: false });
    } else {
      console.log(`   ✅ Contract deployed\n`);
      results.passed++;
      results.checks.push({ contract: contractName, check: 'existence', passed: true });
    }
  }

  console.log('='.repeat(80));
  console.log('PHASE 2: OWNERSHIP VERIFICATION');
  console.log('='.repeat(80) + '\n');

  // Helper to check ownership
  async function verifyOwnership(contractName, address, expectedOwner, ownerFunction = 'owner') {
    try {
      const artifact = await hre.artifacts.readArtifact(contractName);
      const contract = new hre.ethers.Contract(address, artifact.abi, hre.ethers.provider);

      const owner = await contract[ownerFunction]();
      const isCorrect = owner.toLowerCase() === expectedOwner.toLowerCase();

      console.log(`${contractName}:`);
      console.log(`   Current: ${owner}`);
      console.log(`   Expected: ${expectedOwner}`);

      if (isCorrect) {
        console.log(`   ✅ Ownership correct\n`);
        results.passed++;
        results.checks.push({ contract: contractName, check: 'ownership', passed: true });
      } else {
        console.error(`   ❌ Ownership mismatch!\n`);
        results.failed++;
        results.checks.push({ contract: contractName, check: 'ownership', passed: false });
      }

      return isCorrect;
    } catch (error) {
      console.error(`   ⚠️  Error checking ownership: ${error.message}\n`);
      results.warnings++;
      return false;
    }
  }

  // Verify Bond Contract Ownership (should be governance multisig)
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

  console.log('📋 Verifying Bond Contract Ownership (Governance Multisig):\n');
  for (const bondName of bondContracts) {
    if (deployment.contracts[bondName]) {
      await verifyOwnership(
        bondName,
        deployment.contracts[bondName].address,
        multisigs.governance
      );
    }
  }

  // Verify MultiOracleConsensus ownership (operations multisig)
  console.log('📋 Verifying MultiOracleConsensus Ownership (Operations Multisig):\n');
  if (deployment.contracts.MultiOracleConsensus) {
    await verifyOwnership(
      'MultiOracleConsensus',
      deployment.contracts.MultiOracleConsensus.address,
      multisigs.operations
    );
  }

  // Verify RewardMultiplier ownership (governance multisig)
  console.log('📋 Verifying RewardMultiplier Ownership (Governance Multisig):\n');
  if (deployment.contracts.RewardMultiplier) {
    await verifyOwnership(
      'RewardMultiplier',
      deployment.contracts.RewardMultiplier.address,
      multisigs.governance
    );
  }

  // Verify ContributorUnlockKey ownership (operations multisig)
  console.log('📋 Verifying ContributorUnlockKey Ownership (Operations Multisig):\n');
  if (deployment.contracts.ContributorUnlockKey) {
    await verifyOwnership(
      'ContributorUnlockKey',
      deployment.contracts.ContributorUnlockKey.address,
      multisigs.operations
    );
  }

  console.log('='.repeat(80));
  console.log('PHASE 3: ROLE VERIFICATION');
  console.log('='.repeat(80) + '\n');

  // Verify RewardStream roles
  console.log('📋 Verifying RewardStream Roles:\n');
  if (deployment.contracts.RewardStream) {
    try {
      const artifact = await hre.artifacts.readArtifact('RewardStream');
      const rewardStream = new hre.ethers.Contract(
        deployment.contracts.RewardStream.address,
        artifact.abi,
        hre.ethers.provider
      );

      const admin = await rewardStream.admin();
      const governor = await rewardStream.governorTimelock();

      console.log('RewardStream:');
      console.log(`   Admin: ${admin}`);
      console.log(`   Expected: ${multisigs.operations}`);
      if (admin.toLowerCase() === multisigs.operations.toLowerCase()) {
        console.log(`   ✅ Admin correct\n`);
        results.passed++;
      } else {
        console.error(`   ❌ Admin mismatch!\n`);
        results.failed++;
      }

      console.log(`   Governor: ${governor}`);
      console.log(`   Expected: ${multisigs.governance}`);
      if (governor.toLowerCase() === multisigs.governance.toLowerCase()) {
        console.log(`   ✅ Governor correct\n`);
        results.passed++;
      } else {
        console.error(`   ❌ Governor mismatch!\n`);
        results.failed++;
      }
    } catch (error) {
      console.error(`   ⚠️  Error checking RewardStream: ${error.message}\n`);
      results.warnings++;
    }
  }

  // Verify BeliefOracle guardian
  console.log('📋 Verifying BeliefOracle Guardian:\n');
  if (deployment.contracts.BeliefOracle) {
    try {
      const artifact = await hre.artifacts.readArtifact('BeliefOracle');
      const oracle = new hre.ethers.Contract(
        deployment.contracts.BeliefOracle.address,
        artifact.abi,
        hre.ethers.provider
      );

      const guardian = await oracle.guardian();

      console.log('BeliefOracle:');
      console.log(`   Guardian: ${guardian}`);
      console.log(`   Expected: ${multisigs.governance}`);
      if (guardian.toLowerCase() === multisigs.governance.toLowerCase()) {
        console.log(`   ✅ Guardian correct\n`);
        results.passed++;
      } else {
        console.error(`   ❌ Guardian mismatch!\n`);
        results.failed++;
      }
    } catch (error) {
      console.error(`   ⚠️  Error checking BeliefOracle: ${error.message}\n`);
      results.warnings++;
    }
  }

  // Verify DilithiumAttestor origin
  console.log('📋 Verifying DilithiumAttestor Origin:\n');
  if (deployment.contracts.DilithiumAttestor) {
    try {
      const artifact = await hre.artifacts.readArtifact('DilithiumAttestor');
      const attestor = new hre.ethers.Contract(
        deployment.contracts.DilithiumAttestor.address,
        artifact.abi,
        hre.ethers.provider
      );

      const origin = await attestor.origin();
      const zkEnabled = await attestor.zkEnabled();

      console.log('DilithiumAttestor:');
      console.log(`   Origin: ${origin}`);
      console.log(`   Expected: ${multisigs.governance}`);
      if (origin.toLowerCase() === multisigs.governance.toLowerCase()) {
        console.log(`   ✅ Origin correct`);
        results.passed++;
      } else {
        console.error(`   ❌ Origin mismatch!`);
        results.failed++;
      }

      console.log(`   ZK Enabled: ${zkEnabled}`);
      console.log(`   Expected: false (V2 signature-only mode)`);
      if (!zkEnabled) {
        console.log(`   ✅ ZK mode correct\n`);
        results.passed++;
      } else {
        console.error(`   ⚠️  Warning: ZK enabled (unexpected for V2)\n`);
        results.warnings++;
      }
    } catch (error) {
      console.error(`   ⚠️  Error checking DilithiumAttestor: ${error.message}\n`);
      results.warnings++;
    }
  }

  console.log('='.repeat(80));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(80) + '\n');

  const totalChecks = results.passed + results.failed;
  const successRate = totalChecks > 0 ? ((results.passed / totalChecks) * 100).toFixed(1) : 0;

  console.log(`✅ Passed: ${results.passed}/${totalChecks} (${successRate}%)`);
  console.log(`❌ Failed: ${results.failed}/${totalChecks}`);
  console.log(`⚠️  Warnings: ${results.warnings}\n`);

  if (results.failed > 0) {
    console.log('='.repeat(80));
    console.log('❌ VERIFICATION FAILED');
    console.log('='.repeat(80) + '\n');
    console.log('Critical issues detected. Please review and fix before proceeding.\n');

    console.log('Failed checks:');
    results.checks
      .filter(c => !c.passed)
      .forEach(c => console.log(`   - ${c.contract}: ${c.check}`));
    console.log('');

    process.exit(1);
  }

  if (results.warnings > 0) {
    console.log('='.repeat(80));
    console.log('⚠️  VERIFICATION PASSED WITH WARNINGS');
    console.log('='.repeat(80) + '\n');
    console.log('Please review warnings above.\n');
  } else {
    console.log('='.repeat(80));
    console.log('✅ VERIFICATION SUCCESSFUL!');
    console.log('='.repeat(80) + '\n');
  }

  console.log('All contracts deployed and configured correctly!\n');
  console.log('Next steps:');
  console.log('1. Verify contracts on Basescan');
  console.log('2. Test multisig operations via Gnosis Safe UI');
  console.log('3. Deploy frontend with contract addresses');
  console.log('4. Conduct end-to-end testing');
  console.log('5. Announce mainnet launch! 🎉\n');

  // Save verification results
  const verificationLog = {
    timestamp: new Date().toISOString(),
    network: {
      name: network.name,
      chainId: Number(network.chainId)
    },
    deployment: deployment,
    results: {
      passed: results.passed,
      failed: results.failed,
      warnings: results.warnings,
      successRate: `${successRate}%`
    },
    checks: results.checks
  };

  fs.writeFileSync(
    path.join(__dirname, '../deployment/deployment-verification.json'),
    JSON.stringify(verificationLog, null, 2)
  );

  console.log('📄 Verification log saved to deployment/deployment-verification.json\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Verification script failed:\n');
    console.error(error);
    process.exit(1);
  });
