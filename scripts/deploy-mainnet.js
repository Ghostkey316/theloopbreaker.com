const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy Vaultfire to Base Mainnet
 *
 * This script deploys the core Vaultfire contracts to Base Mainnet.
 * Made as simple as possible for non-technical founder deployment.
 *
 * Prerequisites:
 * 1. .env file with PRIVATE_KEY set (wallet with ETH on Base)
 * 2. Run: npx hardhat run scripts/deploy-mainnet.js --network baseMainnet
 */
async function main() {
  console.log("\n");
  console.log("🔥".repeat(30));
  console.log("🔥 VAULTFIRE MAINNET DEPLOYMENT 🔥");
  console.log("🔥".repeat(30));
  console.log("\n");

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer || !deployer.address) {
    console.error("❌ ERROR: No wallet configured!");
    console.error("   Make sure you have PRIVATE_KEY in your .env file");
    process.exit(1);
  }

  const balance = await deployer.getBalance();
  const balanceETH = hre.ethers.utils.formatEther(balance);

  console.log("📍 Deployment Information:");
  console.log(`   Network: ${hre.network.name}`);
  console.log(`   Chain ID: ${hre.network.config.chainId}`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Balance: ${balanceETH} ETH`);
  console.log("\n");

  // Check balance
  if (balance.lt(hre.ethers.utils.parseEther("0.01"))) {
    console.error("❌ ERROR: Insufficient ETH for deployment!");
    console.error(`   You have: ${balanceETH} ETH`);
    console.error(`   You need: At least 0.01 ETH (~$30-40)`);
    console.error("\n   Add ETH to your wallet and try again.");
    process.exit(1);
  }

  // Confirm mainnet deployment
  if (hre.network.name === "baseMainnet") {
    console.log("⚠️  WARNING: You are deploying to MAINNET!");
    console.log("   This will cost real ETH and cannot be undone.");
    console.log("   Press Ctrl+C within 10 seconds to cancel...\n");

    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log("✅ Proceeding with mainnet deployment...\n");
  }

  // Deployment configuration
  const config = {
    origin: deployer.address,
    zkEnabled: false, // Start with signature-only mode (simpler)
    verifierAddress: hre.ethers.constants.AddressZero,
  };

  console.log("📋 Configuration:");
  console.log(`   Origin: ${config.origin}`);
  console.log(`   ZK Mode: ${config.zkEnabled ? 'Enabled' : 'Disabled (Signature-Only)'}`);
  console.log("\n");

  // ===============================================
  // DEPLOY CONTRACT
  // ===============================================
  console.log("1️⃣ Deploying DilithiumAttestor contract...\n");

  const DilithiumAttestor = await hre.ethers.getContractFactory("DilithiumAttestor");

  console.log("   ⏳ Sending deployment transaction...");
  const attestor = await DilithiumAttestor.deploy(
    config.origin,
    config.zkEnabled,
    config.verifierAddress
  );

  console.log("   ⏳ Waiting for transaction confirmation...");
  await attestor.deployed();

  console.log("\n");
  console.log("✅".repeat(30));
  console.log("   CONTRACT DEPLOYED TO MAINNET!");
  console.log("✅".repeat(30));
  console.log("\n");
  console.log(`   📍 Address: ${attestor.address}`);
  console.log(`   📄 Tx Hash: ${attestor.deployTransaction.hash}`);
  console.log("\n");

  // ===============================================
  // SAVE DEPLOYMENT INFO
  // ===============================================
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      DilithiumAttestor: {
        address: attestor.address,
        txHash: attestor.deployTransaction.hash,
        origin: config.origin,
        zkEnabled: config.zkEnabled,
        verifierAddress: config.verifierAddress,
      },
    },
  };

  // Save to deployments directory
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `vaultfire-mainnet-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("💾 Deployment info saved to:");
  console.log(`   ${filepath}\n`);

  // ===============================================
  // UPDATE ENV FILES
  // ===============================================
  console.log("2️⃣ Updating environment files...\n");

  const envPath = path.join(__dirname, "..", "base-mini-app", ".env.example");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");
    envContent = envContent.replace(
      /NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=.*/,
      `NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=${attestor.address}`
    );
    fs.writeFileSync(envPath, envContent);
    console.log("   ✅ Updated base-mini-app/.env.example\n");
  }

  // ===============================================
  // FINAL SUMMARY
  // ===============================================
  console.log("\n");
  console.log("🎉".repeat(30));
  console.log("🎉 DEPLOYMENT COMPLETE! 🎉");
  console.log("🎉".repeat(30));
  console.log("\n");

  console.log("📝 SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network: Base Mainnet (Chain ${deploymentInfo.chainId})`);
  console.log(`Contract Address: ${attestor.address}`);
  console.log(`Transaction: ${attestor.deployTransaction.hash}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Mode: Signature-Only (Production Ready)`);
  console.log("=".repeat(60));
  console.log("\n");

  console.log("🔗 View on BaseScan:");
  console.log(`https://basescan.org/address/${attestor.address}`);
  console.log("\n");

  console.log("📋 NEXT STEPS:");
  console.log("=".repeat(60));
  console.log("1. Copy this contract address:");
  console.log(`   ${attestor.address}`);
  console.log("\n");
  console.log("2. Update base-mini-app/.env.local:");
  console.log(`   NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=${attestor.address}`);
  console.log("\n");
  console.log("3. Deploy demo app to Vercel:");
  console.log("   cd base-mini-app");
  console.log("   vercel --prod");
  console.log("\n");
  console.log("4. Configure RISC Zero Bonsai (for ZK proofs)");
  console.log("5. Start reaching out to partners");
  console.log("6. Submit Base Ecosystem Grant");
  console.log("=".repeat(60));
  console.log("\n");

  console.log("🌎 Vaultfire is now LIVE on Base Mainnet!");
  console.log("🌎 Privacy over surveillance. Freedom over control.");
  console.log("\n");

  // ===============================================
  // VERIFY ON BASESCAN (if API key provided)
  // ===============================================
  if (process.env.BASESCAN_API_KEY) {
    console.log("🔍 Verifying contract on BaseScan...");
    console.log("   ⏳ Waiting 30 seconds for indexing...\n");
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      await hre.run("verify:verify", {
        address: attestor.address,
        constructorArguments: [
          config.origin,
          config.zkEnabled,
          config.verifierAddress,
        ],
      });
      console.log("   ✅ Contract verified on BaseScan!\n");
    } catch (error) {
      console.log(`   ⚠️ Verification failed: ${error.message}`);
      console.log("   You can verify manually later at basescan.org\n");
    }
  } else {
    console.log("ℹ️  Skipping BaseScan verification (no API key)");
    console.log("   Set BASESCAN_API_KEY in .env to enable verification\n");
  }

  return deploymentInfo;
}

// Run deployment
main()
  .then(() => {
    console.log("\n✅ Script completed successfully!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n");
    console.error("❌".repeat(30));
    console.error("❌ DEPLOYMENT FAILED!");
    console.error("❌".repeat(30));
    console.error("\n");
    console.error("Error details:");
    console.error(error);
    console.error("\n");
    console.error("💡 Common fixes:");
    console.error("1. Check your .env file has PRIVATE_KEY");
    console.error("2. Make sure you have enough ETH in your wallet");
    console.error("3. Verify you're connected to Base Mainnet");
    console.error("\n");
    process.exit(1);
  });
