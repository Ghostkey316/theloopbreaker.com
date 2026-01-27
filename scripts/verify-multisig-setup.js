const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Multisig Setup Verification Script
 *
 * Verifies that all Gnosis Safe multisig wallets are properly configured
 * before proceeding with mainnet deployment.
 *
 * Checks:
 * 1. All multisig addresses are valid
 * 2. All Safes exist on Base Mainnet
 * 3. Thresholds are configured correctly
 * 4. Safes have sufficient ETH for operations
 *
 * Run: node scripts/verify-multisig-setup.js
 */

const MULTISIG_CONFIG_PATH = path.join(__dirname, '../deployment/mainnet-multisig-config.json');

// Gnosis Safe ABI (minimal - just what we need)
const GNOSIS_SAFE_ABI = [
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
  "function VERSION() view returns (string)"
];

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 MULTISIG SETUP VERIFICATION');
  console.log('='.repeat(80) + '\n');

  // Load configuration
  let config;
  try {
    config = JSON.parse(fs.readFileSync(MULTISIG_CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.error(`❌ Error loading ${MULTISIG_CONFIG_PATH}:`);
    console.error(error.message);
    process.exit(1);
  }

  // Verify network
  const network = await hre.ethers.provider.getNetwork();
  console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})\n`);

  if (network.chainId !== 8453n) {
    console.error(`❌ Wrong network! Expected Base Mainnet (8453), got ${network.chainId}`);
    console.error('   Switch to Base Mainnet in hardhat.config.js\n');
    process.exit(1);
  }

  console.log('✅ Connected to Base Mainnet\n');

  // Verify each multisig
  const multisigs = ['governance', 'operations', 'treasury'];
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: []
  };

  for (const multisigType of multisigs) {
    const multisigConfig = config.multisigs[multisigType];
    const address = multisigConfig.address;
    const expectedThreshold = multisigConfig.threshold;
    const expectedSigners = multisigConfig.signers;

    console.log('─'.repeat(80));
    console.log(`\n📋 Checking ${multisigType.toUpperCase()} Multisig\n`);
    console.log(`   Address: ${address}`);
    console.log(`   Expected Threshold: ${expectedThreshold}/${expectedSigners}\n`);

    // Check 1: Valid address format
    if (!hre.ethers.isAddress(address)) {
      console.error(`   ❌ Invalid address format\n`);
      results.failed++;
      results.errors.push(`${multisigType}: Invalid address format`);
      continue;
    }
    console.log(`   ✅ Valid address format`);

    // Check 2: Placeholder check
    if (address.includes('ADDRESS_HERE')) {
      console.error(`   ❌ Placeholder address detected - please create Safe first\n`);
      results.failed++;
      results.errors.push(`${multisigType}: Placeholder address not replaced`);
      continue;
    }

    // Check 3: Contract exists on-chain
    const code = await hre.ethers.provider.getCode(address);
    if (code === '0x') {
      console.error(`   ❌ No contract found at this address`);
      console.error(`   ⚠️  Make sure you've deployed the Gnosis Safe on Base Mainnet\n`);
      results.failed++;
      results.errors.push(`${multisigType}: No contract at address`);
      continue;
    }
    console.log(`   ✅ Contract exists on-chain`);

    // Check 4: Verify it's a Gnosis Safe
    try {
      const safe = new hre.ethers.Contract(address, GNOSIS_SAFE_ABI, hre.ethers.provider);

      // Get threshold
      const threshold = await safe.getThreshold();
      console.log(`   ✅ Gnosis Safe detected`);
      console.log(`   📊 Current threshold: ${threshold}`);

      // Get owners
      const owners = await safe.getOwners();
      console.log(`   👥 Current signers: ${owners.length}`);

      // Verify threshold matches expected
      if (Number(threshold) !== expectedThreshold) {
        console.error(`   ⚠️  WARNING: Threshold mismatch!`);
        console.error(`      Expected: ${expectedThreshold}, Got: ${threshold}`);
        results.warnings++;
      } else {
        console.log(`   ✅ Threshold matches expected (${expectedThreshold})`);
      }

      // Verify signer count matches expected
      if (owners.length !== expectedSigners) {
        console.error(`   ⚠️  WARNING: Signer count mismatch!`);
        console.error(`      Expected: ${expectedSigners}, Got: ${owners.length}`);
        results.warnings++;
      } else {
        console.log(`   ✅ Signer count matches expected (${expectedSigners})`);
      }

      // Check 5: Verify Safe has ETH
      const balance = await hre.ethers.provider.getBalance(address);
      const balanceETH = hre.ethers.formatEther(balance);
      console.log(`   💰 Balance: ${balanceETH} ETH`);

      const minBalance = multisigType === 'operations' ? 0.1 : 0.05;
      if (parseFloat(balanceETH) < minBalance) {
        console.error(`   ⚠️  WARNING: Low balance! Recommended: ${minBalance} ETH`);
        results.warnings++;
      } else {
        console.log(`   ✅ Sufficient balance for operations`);
      }

      console.log(`\n   ✅ ${multisigType.toUpperCase()} multisig verified!\n`);
      results.passed++;

    } catch (error) {
      console.error(`   ❌ Error verifying Safe:`);
      console.error(`      ${error.message}\n`);
      results.failed++;
      results.errors.push(`${multisigType}: ${error.message}`);
      continue;
    }
  }

  // Final summary
  console.log('─'.repeat(80));
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(80) + '\n');

  console.log(`✅ Passed: ${results.passed}/3`);
  console.log(`❌ Failed: ${results.failed}/3`);
  console.log(`⚠️  Warnings: ${results.warnings}\n`);

  if (results.errors.length > 0) {
    console.log('❌ Errors:\n');
    results.errors.forEach(error => console.log(`   - ${error}`));
    console.log('');
  }

  if (results.failed > 0) {
    console.log('='.repeat(80));
    console.log('❌ VERIFICATION FAILED');
    console.log('='.repeat(80) + '\n');
    console.log('Please fix the errors above before proceeding with deployment.\n');
    console.log('Next steps:');
    console.log('1. Create Gnosis Safe wallets on Base Mainnet (see deployment/MAINNET_MULTISIG_SETUP.md)');
    console.log('2. Update deployment/mainnet-multisig-config.json with Safe addresses');
    console.log('3. Fund each Safe with ETH (0.05-0.1 ETH)');
    console.log('4. Run this script again\n');
    process.exit(1);
  }

  if (results.warnings > 0) {
    console.log('='.repeat(80));
    console.log('⚠️  VERIFICATION PASSED WITH WARNINGS');
    console.log('='.repeat(80) + '\n');
    console.log('You can proceed with deployment, but please review the warnings above.\n');
  } else {
    console.log('='.repeat(80));
    console.log('✅ VERIFICATION SUCCESSFUL!');
    console.log('='.repeat(80) + '\n');
    console.log('All multisig wallets are properly configured.\n');
    console.log('Next steps:');
    console.log('1. Review deployment/mainnet-multisig-config.json one more time');
    console.log('2. Ensure .env file is configured with PRIVATE_KEY');
    console.log('3. Run mainnet deployment: npx hardhat run scripts/deploy-mainnet-production.js --network baseMainnet\n');
  }

  // Save verification results
  const verificationLog = {
    timestamp: new Date().toISOString(),
    network: {
      name: network.name,
      chainId: Number(network.chainId)
    },
    results: {
      passed: results.passed,
      failed: results.failed,
      warnings: results.warnings,
      errors: results.errors
    },
    multisigs: {}
  };

  // Add details for each multisig
  for (const multisigType of multisigs) {
    const address = config.multisigs[multisigType].address;
    if (hre.ethers.isAddress(address) && !address.includes('ADDRESS_HERE')) {
      try {
        const safe = new hre.ethers.Contract(address, GNOSIS_SAFE_ABI, hre.ethers.provider);
        const threshold = await safe.getThreshold();
        const owners = await safe.getOwners();
        const balance = await hre.ethers.provider.getBalance(address);

        verificationLog.multisigs[multisigType] = {
          address,
          threshold: Number(threshold),
          signers: owners.length,
          balance: hre.ethers.formatEther(balance),
          verified: true
        };
      } catch (error) {
        verificationLog.multisigs[multisigType] = {
          address,
          verified: false,
          error: error.message
        };
      }
    }
  }

  fs.writeFileSync(
    path.join(__dirname, '../deployment/multisig-verification.json'),
    JSON.stringify(verificationLog, null, 2)
  );

  console.log('📄 Verification log saved to deployment/multisig-verification.json\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Verification script failed:\n');
    console.error(error);
    process.exit(1);
  });
