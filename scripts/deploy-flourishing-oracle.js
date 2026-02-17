/**
 * Deploy FlourishingMetricsOracle
 *
 * Multi-oracle consensus system for flourishing metrics.  Eliminates
 * single-oracle dependency by requiring 3+ independent oracles and
 * reaching consensus via median-value aggregation.
 *
 * Security Enhancement — Professional Security Audit 2026
 *
 * Prerequisites:
 *   1. Oracle operator addresses agreed upon
 *   2. Deployer wallet funded with gas
 *   3. PRIVATE_KEY set in .env
 *
 * Environment variables (optional):
 *   ORACLE_ADDRESSES — Comma-separated list of initial oracle addresses
 *                      (minimum 3 required before starting rounds)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-flourishing-oracle.js --network base
 *   npx hardhat run scripts/deploy-flourishing-oracle.js --network baseSepolia
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔮 VAULTFIRE FLOURISHING METRICS ORACLE DEPLOYMENT");
  console.log("=".repeat(80) + "\n");

  // ── Network & Deployer ──────────────────────────────────────────────────

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // ── Validation ──────────────────────────────────────────────────────────

  console.log("🔍 Pre-Deployment Validation:\n");

  if (balance < hre.ethers.parseEther("0.01")) {
    console.error(
      `❌ Insufficient balance. Need at least 0.01 ETH, have ${hre.ethers.formatEther(balance)} ETH`
    );
    process.exit(1);
  }
  console.log("✅ Deployer balance sufficient\n");

  // ── Deployment ──────────────────────────────────────────────────────────

  console.log("📦 Deploying FlourishingMetricsOracle...\n");

  const FlourishingMetricsOracle = await hre.ethers.getContractFactory(
    "FlourishingMetricsOracle"
  );
  const oracle = await FlourishingMetricsOracle.deploy();
  await oracle.waitForDeployment();

  const oracleAddress = await oracle.getAddress();
  const deployTx = oracle.deploymentTransaction();

  console.log(`✅ FlourishingMetricsOracle deployed: ${oracleAddress}`);
  console.log(`📝 TX: ${deployTx.hash}\n`);

  // ── Post-Deployment Verification ────────────────────────────────────────

  console.log("🔍 Verifying deployment...\n");

  const deployedOwner = await oracle.owner();
  const minimumQuorum = await oracle.MINIMUM_QUORUM();
  const maximumOracles = await oracle.MAXIMUM_ORACLES();
  const submissionWindow = await oracle.SUBMISSION_WINDOW();
  const maxDeviationBps = await oracle.MAX_DEVIATION_BPS();

  console.log(`   Owner: ${deployedOwner}`);
  console.log(`   Minimum Quorum: ${minimumQuorum}`);
  console.log(`   Maximum Oracles: ${maximumOracles}`);
  console.log(`   Submission Window: ${Number(submissionWindow) / 3600} hours`);
  console.log(`   Max Deviation: ${Number(maxDeviationBps) / 100}%`);

  if (deployedOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("\n❌ Owner mismatch after deployment!");
    process.exit(1);
  }

  console.log("\n✅ Deployment verified!\n");

  // ── Register Initial Oracles (optional) ─────────────────────────────────

  const oracleEnv = process.env.ORACLE_ADDRESSES;
  if (oracleEnv) {
    const oracleAddresses = oracleEnv.split(",").map((s) => s.trim());

    console.log(
      `📋 Registering ${oracleAddresses.length} initial oracle(s)...\n`
    );

    for (const addr of oracleAddresses) {
      if (!hre.ethers.isAddress(addr)) {
        console.error(`   ⚠️  Skipping invalid address: ${addr}`);
        continue;
      }

      try {
        const tx = await oracle.addOracle(addr);
        await tx.wait(2);
        console.log(`   ✅ Oracle registered: ${addr}`);
      } catch (error) {
        console.error(`   ⚠️  Failed to register ${addr}: ${error.message}`);
      }
    }

    const oracleCount = await oracle.oracleCount();
    console.log(`\n   Total registered oracles: ${oracleCount}\n`);

    if (Number(oracleCount) < Number(minimumQuorum)) {
      console.log(
        `   ⚠️  Need at least ${minimumQuorum} oracles before starting rounds.`
      );
      console.log(
        `      Register more with: oracle.addOracle(address)\n`
      );
    }
  } else {
    console.log("ℹ️  No ORACLE_ADDRESSES set — skipping initial oracle registration.");
    console.log("   Register oracles post-deployment with addOracle(address).\n");
  }

  // ── Verification on Basescan ────────────────────────────────────────────

  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("⏳ Waiting for block confirmations...");
    await deployTx.wait(6);

    console.log("🔍 Verifying contract on Basescan...");
    try {
      await hre.run("verify:verify", {
        address: oracleAddress,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Basescan\n");
    } catch (error) {
      console.log(`⚠️  Verification failed: ${error.message}\n`);
    }
  }

  // ── Save Deployment Info ────────────────────────────────────────────────

  const deploymentInfo = {
    contract: "FlourishingMetricsOracle",
    network: network.name,
    chainId: network.chainId.toString(),
    address: oracleAddress,
    deployer: deployer.address,
    tx: deployTx.hash,
    timestamp: new Date().toISOString(),
    configuration: {
      minimumQuorum: Number(minimumQuorum),
      maximumOracles: Number(maximumOracles),
      submissionWindowHours: Number(submissionWindow) / 3600,
      maxDeviationBps: Number(maxDeviationBps),
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `flourishing-oracle-${network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Deployment info saved: ${deploymentFile}\n`);

  // ── Summary & Next Steps ────────────────────────────────────────────────

  console.log("=".repeat(80));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(80) + "\n");

  console.log(`FlourishingMetricsOracle: ${oracleAddress}`);
  console.log(`Owner: ${deployedOwner}`);
  console.log(`Minimum Quorum: ${minimumQuorum} oracles`);
  console.log(`Submission Window: ${Number(submissionWindow) / 3600} hours\n`);

  console.log("🎯 Next Steps:\n");
  console.log("1. Register at least 3 oracle addresses:");
  console.log("   oracle.addOracle(oracleAddress1)");
  console.log("   oracle.addOracle(oracleAddress2)");
  console.log("   oracle.addOracle(oracleAddress3)\n");
  console.log("2. Start a consensus round:");
  console.log('   oracle.startRound(metricId)  // e.g. keccak256("human_flourishing_index")\n');
  console.log("3. Transfer ownership to MultisigGovernance:");
  console.log("   oracle.transferOwnership(multisigGovernanceAddress)\n");
  console.log(
    `4. View on BaseScan: https://basescan.org/address/${oracleAddress}\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
