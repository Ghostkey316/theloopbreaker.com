/**
 * Deploy MultisigGovernance
 *
 * M-of-N multisig governance for critical Vaultfire owner operations.
 * Replaces single-owner control with multi-party approval for protocol-level
 * changes such as ownership transfers, oracle management, and image ID updates.
 *
 * Security Enhancement — Professional Security Audit 2026
 *
 * Prerequisites:
 *   1. Signer addresses agreed upon and funded on Base Mainnet
 *   2. Threshold (M) and signer count (N) decided (e.g. 2-of-3, 3-of-5)
 *   3. Deployer wallet funded with gas
 *   4. PRIVATE_KEY set in .env
 *
 * Environment variables:
 *   MULTISIG_SIGNERS  — Comma-separated list of signer addresses
 *   MULTISIG_THRESHOLD — Number of confirmations required (M in M-of-N)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-multisig-governance.js --network base
 *   npx hardhat run scripts/deploy-multisig-governance.js --network baseSepolia
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Default signers for development/testing — MUST be overridden for production
const DEFAULT_SIGNERS = [];
const DEFAULT_THRESHOLD = 0;

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔐 VAULTFIRE MULTISIG GOVERNANCE DEPLOYMENT");
  console.log("=".repeat(80) + "\n");

  // ── Network & Deployer ──────────────────────────────────────────────────

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // ── Configuration ───────────────────────────────────────────────────────

  const signersEnv = process.env.MULTISIG_SIGNERS;
  const thresholdEnv = process.env.MULTISIG_THRESHOLD;

  let signerAddresses;
  let threshold;

  if (signersEnv && thresholdEnv) {
    signerAddresses = signersEnv.split(",").map((s) => s.trim());
    threshold = parseInt(thresholdEnv, 10);
  } else if (DEFAULT_SIGNERS.length > 0) {
    signerAddresses = DEFAULT_SIGNERS;
    threshold = DEFAULT_THRESHOLD;
  } else {
    console.error("❌ No signer configuration found.");
    console.error("   Set MULTISIG_SIGNERS and MULTISIG_THRESHOLD in .env");
    console.error("   Example:");
    console.error('     MULTISIG_SIGNERS="0xAddr1,0xAddr2,0xAddr3"');
    console.error("     MULTISIG_THRESHOLD=2\n");
    process.exit(1);
  }

  // ── Validation ──────────────────────────────────────────────────────────

  console.log("🔍 Pre-Deployment Validation:\n");

  if (signerAddresses.length === 0) {
    console.error("❌ No signers provided.");
    process.exit(1);
  }

  if (threshold === 0 || threshold > signerAddresses.length) {
    console.error(
      `❌ Invalid threshold: ${threshold}. Must be 1 ≤ M ≤ ${signerAddresses.length}`
    );
    process.exit(1);
  }

  for (const addr of signerAddresses) {
    if (!hre.ethers.isAddress(addr)) {
      console.error(`❌ Invalid signer address: ${addr}`);
      process.exit(1);
    }
  }

  // Check for duplicates
  const unique = new Set(signerAddresses.map((a) => a.toLowerCase()));
  if (unique.size !== signerAddresses.length) {
    console.error("❌ Duplicate signer addresses detected.");
    process.exit(1);
  }

  console.log(`✅ Signers (${signerAddresses.length}):`);
  signerAddresses.forEach((addr, i) => {
    console.log(`   ${i + 1}. ${addr}`);
  });
  console.log(`✅ Threshold: ${threshold}-of-${signerAddresses.length}`);

  if (balance < hre.ethers.parseEther("0.01")) {
    console.error(
      `\n❌ Insufficient balance. Need at least 0.01 ETH, have ${hre.ethers.formatEther(balance)} ETH`
    );
    process.exit(1);
  }
  console.log("✅ Deployer balance sufficient\n");

  // ── Deployment ──────────────────────────────────────────────────────────

  console.log("📦 Deploying MultisigGovernance...\n");

  const MultisigGovernance = await hre.ethers.getContractFactory(
    "MultisigGovernance"
  );
  const multisig = await MultisigGovernance.deploy(
    signerAddresses,
    threshold
  );
  await multisig.waitForDeployment();

  const multisigAddress = await multisig.getAddress();
  const deployTx = multisig.deploymentTransaction();

  console.log(`✅ MultisigGovernance deployed: ${multisigAddress}`);
  console.log(`📝 TX: ${deployTx.hash}\n`);

  // ── Post-Deployment Verification ────────────────────────────────────────

  console.log("🔍 Verifying deployment...\n");

  const deployedThreshold = await multisig.threshold();
  const deployedSignerCount = await multisig.getSignerCount();
  const deployedSigners = await multisig.getSigners();

  console.log(`   Threshold: ${deployedThreshold}`);
  console.log(`   Signer Count: ${deployedSignerCount}`);
  console.log(`   Signers:`);
  deployedSigners.forEach((addr, i) => {
    console.log(`     ${i + 1}. ${addr}`);
  });

  if (Number(deployedThreshold) !== threshold) {
    console.error("\n❌ Threshold mismatch after deployment!");
    process.exit(1);
  }

  if (Number(deployedSignerCount) !== signerAddresses.length) {
    console.error("\n❌ Signer count mismatch after deployment!");
    process.exit(1);
  }

  console.log("\n✅ Deployment verified!\n");

  // ── Verification on Basescan ────────────────────────────────────────────

  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("⏳ Waiting for block confirmations...");
    await deployTx.wait(6);

    console.log("🔍 Verifying contract on Basescan...");
    try {
      await hre.run("verify:verify", {
        address: multisigAddress,
        constructorArguments: [signerAddresses, threshold],
      });
      console.log("✅ Contract verified on Basescan\n");
    } catch (error) {
      console.log(`⚠️  Verification failed: ${error.message}\n`);
    }
  }

  // ── Save Deployment Info ────────────────────────────────────────────────

  const deploymentInfo = {
    contract: "MultisigGovernance",
    network: network.name,
    chainId: network.chainId.toString(),
    address: multisigAddress,
    deployer: deployer.address,
    tx: deployTx.hash,
    timestamp: new Date().toISOString(),
    configuration: {
      signers: signerAddresses,
      threshold: threshold,
      transactionExpiry: "7 days",
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `multisig-governance-${network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Deployment info saved: ${deploymentFile}\n`);

  // ── Summary & Next Steps ────────────────────────────────────────────────

  console.log("=".repeat(80));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(80) + "\n");

  console.log(`MultisigGovernance: ${multisigAddress}`);
  console.log(`Threshold: ${threshold}-of-${signerAddresses.length}`);
  console.log(`Transaction Expiry: 7 days\n`);

  console.log("🎯 Next Steps:\n");
  console.log(
    "1. Transfer ownership of existing contracts to MultisigGovernance:"
  );
  console.log(
    "   - ProductionBeliefAttestationVerifier.transferOwnership(multisigAddress)"
  );
  console.log(
    "   - FlourishingMetricsOracle.transferOwnership(multisigAddress)"
  );
  console.log(
    "   - MissionEnforcement.transferOwnership(multisigAddress) + acceptOwnership()"
  );
  console.log(
    "   - AntiSurveillance.transferOwnership(multisigAddress)"
  );
  console.log(
    "   - AIPartnershipBondsV2.transferOwnership(multisigAddress) + acceptOwnership()"
  );
  console.log(
    "   - AIAccountabilityBondsV2.transferOwnership(multisigAddress) + acceptOwnership()\n"
  );
  console.log(
    "2. Test multisig operations — propose, confirm, and execute a test transaction\n"
  );
  console.log(
    "3. Verify all ownership transfers completed correctly\n"
  );
  console.log(
    `4. View on BaseScan: https://basescan.org/address/${multisigAddress}\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
