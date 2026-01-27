/**
 * Deploy AI Accountability Bonds V2
 * Global-level verification of AI impact on all humans
 */

const hre = require("hardhat");

async function main() {
  console.log("Deploying AI Accountability Bonds V2...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy AIAccountabilityBondsV2
  const AIAccountabilityBondsV2 = await ethers.getContractFactory("AIAccountabilityBondsV2");

  // Deploy with human treasury address (can be changed to multisig later)
  const humanTreasury = deployer.address; // TODO: Update to multisig/DAO treasury

  const accountabilityBonds = await AIAccountabilityBondsV2.deploy(humanTreasury);
  await accountabilityBonds.waitForDeployment();

  const accountabilityAddress = await accountabilityBonds.getAddress();
  console.log("✅ AIAccountabilityBondsV2 deployed to:", accountabilityAddress);
  console.log("   Human Treasury:", humanTreasury);

  // Verify contract on Etherscan (if not local network)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await accountabilityBonds.deploymentTransaction().wait(6);

    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: accountabilityAddress,
        constructorArguments: [humanTreasury],
      });
      console.log("✅ Contract verified on Etherscan");
    } catch (error) {
      console.log("⚠️  Verification failed:", error.message);
    }
  }

  console.log("\n📋 Deployment Summary:");
  console.log("========================");
  console.log("AIAccountabilityBondsV2:", accountabilityAddress);
  console.log("Human Treasury:", humanTreasury);
  console.log("\n🎯 Next Steps:");
  console.log("1. Test bond creation with: npx hardhat test test/AIAccountabilityBonds.test.js");
  console.log("2. Register oracle sources for global metrics verification");
  console.log("3. Set up multi-AI verification network");
  console.log("4. Configure community challenge parameters");
  console.log("\n⚠️  Important: Update humanTreasury to multisig/DAO address before mainnet");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
