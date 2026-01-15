import { ethers } from "hardhat";

async function main() {
  console.log("🔥 Deploying Vaultfire Contracts to Base...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying from address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Configuration
  const config = {
    // RISC Zero verifier address on Base
    // For testnet deployment, use mock verifier or deploy your own
    riscZeroVerifier: process.env.RISC_ZERO_VERIFIER_ADDRESS || ethers.ZeroAddress,

    // Guest program image ID (from RISC Zero build)
    // This should be the image ID of your compiled guest program
    beliefGuestImageId: process.env.BELIEF_GUEST_IMAGE_ID ||
      "0x" + "42".repeat(32), // Mock image ID for testing

    // Whether to enable ZK verification (set false for testing without proofs)
    zkEnabled: process.env.ZK_ENABLED === "true",
  };

  console.log("Configuration:");
  console.log("- RISC Zero Verifier:", config.riscZeroVerifier);
  console.log("- Belief Guest Image ID:", config.beliefGuestImageId);
  console.log("- ZK Verification Enabled:", config.zkEnabled);
  console.log();

  // Deploy DilithiumAttestor
  console.log("Deploying DilithiumAttestor...");
  const DilithiumAttestor = await ethers.getContractFactory("DilithiumAttestor");
  const dilithiumAttestor = await DilithiumAttestor.deploy(
    config.riscZeroVerifier,
    config.beliefGuestImageId,
    config.zkEnabled
  );

  await dilithiumAttestor.waitForDeployment();
  const dilithiumAddress = await dilithiumAttestor.getAddress();

  console.log("✅ DilithiumAttestor deployed to:", dilithiumAddress);
  console.log();

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      DilithiumAttestor: {
        address: dilithiumAddress,
        constructorArgs: [
          config.riscZeroVerifier,
          config.beliefGuestImageId,
          config.zkEnabled,
        ],
      },
    },
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Update lib/contracts.ts
  console.log("\n💡 Update your lib/contracts.ts file with:");
  console.log(`export const DILITHIUM_ATTESTOR_ADDRESS = '${dilithiumAddress}' as \`0x\${string}\`;`);

  // Verify on Basescan if API key is provided
  if (process.env.BASESCAN_API_KEY) {
    console.log("\n⏳ Waiting 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("Verifying contracts on Basescan...");
    try {
      await hre.run("verify:verify", {
        address: dilithiumAddress,
        constructorArguments: [
          config.riscZeroVerifier,
          config.beliefGuestImageId,
          config.zkEnabled,
        ],
      });
      console.log("✅ Contract verified on Basescan");
    } catch (error) {
      console.log("❌ Verification failed:", error);
    }
  }

  console.log("\n🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
