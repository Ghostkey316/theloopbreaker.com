/**
 * Covenant Deploy Smoke Test
 * Minimal deployment script for CI smoke testing
 * Deploys AIAccountabilityBondsV2 to verify core contracts compile and deploy
 */

const hre = require("hardhat");

async function main() {
  console.log("\n🧪 COVENANT SMOKE TEST DEPLOYMENT\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  // Use GHOSTKEY_ECHO env var as human treasury if set, otherwise use deployer
  const humanTreasury = process.env.GHOSTKEY_ECHO || deployer.address;
  console.log("Human Treasury:", humanTreasury);

  console.log("\n🚀 Deploying AIAccountabilityBondsV2 (smoke test)...");

  const AIAccountabilityBondsV2 = await hre.ethers.getContractFactory("AIAccountabilityBondsV2");
  const bonds = await AIAccountabilityBondsV2.deploy(humanTreasury);

  await bonds.waitForDeployment();
  const address = await bonds.getAddress();

  console.log("\n✅ SMOKE TEST PASSED!");
  console.log("Contract deployed to:", address);
  console.log("TX:", bonds.deploymentTransaction().hash);

  // Quick sanity check
  const storedTreasury = await bonds.humanTreasury();
  if (storedTreasury !== humanTreasury) {
    throw new Error("Human treasury mismatch!");
  }

  console.log("\n✓ Contract state verified");
  console.log("✓ Core protocol contracts are deployable");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ SMOKE TEST FAILED:");
    console.error(error);
    process.exit(1);
  });
