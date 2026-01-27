const hre = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("\n🚀 Deploying ALL 9 Universal Dignity Bonds to Base mainnet...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  const bonds = [
    "PurchasingPowerBonds",
    "HealthCommonsBonds",
    "AIAccountabilityBonds",
    "LaborDignityBonds",
    "EscapeVelocityBonds",
    "CommonGroundBonds",
    "AIPartnershipBonds",
    "BuilderBeliefBonds",
    "VerdantAnchorBonds"
  ];

  const deployedContracts = {};

  for (const bondName of bonds) {
    console.log(`📝 Deploying ${bondName}...`);

    try {
      const BondContract = await hre.ethers.getContractFactory(bondName);
      const bond = await BondContract.deploy();
      await bond.waitForDeployment();
      const address = await bond.getAddress();

      deployedContracts[bondName] = {
        address: address,
        deployer: deployer.address,
        network: hre.network.name,
        deployedAt: new Date().toISOString(),
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString()
      };

      console.log(`✅ ${bondName} deployed to: ${address}\n`);
    } catch (error) {
      console.error(`❌ Failed to deploy ${bondName}:`, error.message);
      process.exit(1);
    }
  }

  // Save all deployment info
  const deploymentSummary = {
    network: hre.network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: deployedContracts
  };

  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }

  fs.writeFileSync(
    `deployments/all-bonds-${hre.network.name}.json`,
    JSON.stringify(deploymentSummary, null, 2)
  );

  console.log("\n✅ ALL 9 BONDS DEPLOYED SUCCESSFULLY!\n");
  console.log("📝 Deployment summary saved to deployments/\n");
  console.log("🔍 Verify contracts with:");
  console.log(`   cd /home/user/ghostkey-316-vaultfire-init`);
  Object.entries(deployedContracts).forEach(([name, info]) => {
    console.log(`   npx hardhat verify --network ${hre.network.name} ${info.address}`);
  });

  console.log("\n📊 Contract Addresses:");
  Object.entries(deployedContracts).forEach(([name, info]) => {
    console.log(`   ${name}: ${info.address}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
