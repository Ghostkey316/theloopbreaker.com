const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy Vaultfire contracts for Base Mini App
 *
 * Deploys:
 * 1. DilithiumAttestor (with zkEnabled=false for V2 launch mode)
 * 2. Optional: BeliefAttestationVerifier (for future ZK integration)
 *
 * Network: Base Sepolia testnet
 */
async function main() {
  console.log("🔥 Deploying Vaultfire Base Mini App Contracts...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📍 Deploying from address: ${deployer.address}`);
  console.log(`⚡ Network: ${hre.network.name}`);
  console.log(`💰 Balance: ${hre.ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

  // Deployment configuration
  const config = {
    origin: deployer.address, // For testnet, use deployer as origin. In production, use multi-sig
    zkEnabled: false,          // V2 launch mode: signature-only verification
    verifierAddress: hre.ethers.constants.AddressZero, // No verifier needed when zkEnabled=false
  };

  console.log("📋 Deployment Configuration:");
  console.log(`   Origin Address: ${config.origin}`);
  console.log(`   ZK Enabled: ${config.zkEnabled}`);
  console.log(`   Verifier Address: ${config.verifierAddress}\n`);

  // ===============================================
  // 1. Deploy DilithiumAttestor
  // ===============================================
  console.log("1️⃣ Deploying DilithiumAttestor...");
  const DilithiumAttestor = await hre.ethers.getContractFactory("DilithiumAttestor");

  const attestor = await DilithiumAttestor.deploy(
    config.origin,
    config.zkEnabled,
    config.verifierAddress
  );

  await attestor.deployed();
  console.log(`   ✅ DilithiumAttestor deployed to: ${attestor.address}`);
  console.log(`   📄 Transaction hash: ${attestor.deployTransaction.hash}\n`);

  // ===============================================
  // 2. Save deployment addresses
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

  // Save to JSON file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `vaultfire-base-mini-app-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${filepath}\n`);

  // ===============================================
  // 3. Update base-mini-app .env.example
  // ===============================================
  console.log("3️⃣ Updating base-mini-app environment variables...");
  const envPath = path.join(__dirname, "..", "base-mini-app", ".env.example");

  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");

    // Update contract addresses
    envContent = envContent.replace(
      /NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=.*/,
      `NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=${attestor.address}`
    );
    envContent = envContent.replace(
      /NEXT_PUBLIC_BELIEF_VERIFIER_ADDRESS=.*/,
      `NEXT_PUBLIC_BELIEF_VERIFIER_ADDRESS=${config.verifierAddress}`
    );

    fs.writeFileSync(envPath, envContent);
    console.log(`   ✅ Updated .env.example with contract addresses\n`);
  }

  // ===============================================
  // 4. Summary
  // ===============================================
  console.log("🎉 Deployment Complete!\n");
  console.log("=" .repeat(60));
  console.log("📝 Deployment Summary");
  console.log("=".repeat(60));
  console.log(`Network: ${hre.network.name} (Chain ID: ${hre.network.config.chainId})`);
  console.log(`DilithiumAttestor: ${attestor.address}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Mode: ${config.zkEnabled ? 'Full ZK' : 'Signature-Only (V2 Launch)'}`);
  console.log("=".repeat(60) + "\n");

  console.log("📋 Next Steps:");
  console.log("1. Copy base-mini-app/.env.example to base-mini-app/.env.local");
  console.log("2. Add your NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
  console.log("3. Test the app on Base Sepolia testnet");
  console.log("4. When ready for ZK: Deploy BeliefAttestationVerifier and redeploy with zkEnabled=true\n");

  console.log("🔍 View on Basescan:");
  console.log(`https://sepolia.basescan.org/address/${attestor.address}\n`);

  // ===============================================
  // 5. Verify on Basescan (if API key provided)
  // ===============================================
  if (process.env.BASESCAN_API_KEY && hre.network.name !== "hardhat") {
    console.log("⏳ Waiting 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("🔍 Verifying contract on Basescan...");
    try {
      await hre.run("verify:verify", {
        address: attestor.address,
        constructorArguments: [
          config.origin,
          config.zkEnabled,
          config.verifierAddress,
        ],
      });
      console.log("   ✅ Contract verified on Basescan\n");
    } catch (error) {
      console.log(`   ⚠️ Verification failed: ${error.message}\n`);
    }
  }

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
