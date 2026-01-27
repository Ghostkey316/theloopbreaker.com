/**
 * Deploy AI Partnership Bonds V2
 * Individual-level verification of AI-human partnerships
 */

const hre = require("hardhat");

async function main() {
  console.log("Deploying AI Partnership Bonds V2...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy AIPartnershipBondsV2
  const AIPartnershipBondsV2 = await ethers.getContractFactory("AIPartnershipBondsV2");
  const partnershipBonds = await AIPartnershipBondsV2.deploy();
  await partnershipBonds.waitForDeployment();

  const partnershipAddress = await partnershipBonds.getAddress();
  console.log("✅ AIPartnershipBondsV2 deployed to:", partnershipAddress);

  // Verify contract on Etherscan (if not local network)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await partnershipBonds.deploymentTransaction().wait(6);

    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: partnershipAddress,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Etherscan");
    } catch (error) {
      console.log("⚠️  Verification failed:", error.message);
    }
  }

  console.log("\n📋 Deployment Summary:");
  console.log("========================");
  console.log("AIPartnershipBondsV2:", partnershipAddress);
  console.log("\n🎯 Next Steps:");
  console.log("1. Test bond creation with: npx hardhat test test/AIPartnershipBonds.test.js");
  console.log("2. Deploy AI Accountability Bonds: npx hardhat run scripts/deploy-ai-accountability.js");
  console.log("3. Configure oracle integration");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
