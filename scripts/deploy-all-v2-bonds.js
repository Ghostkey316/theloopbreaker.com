const hre = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("\n🚀 Deploying ALL 9 Universal Dignity Bonds V2 (Production Ready) to Base...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // All 9 V2 Production-Ready Bonds
  const bonds = [
    { name: "LaborDignityBondsV2", description: "Workers protected > exploited" },
    { name: "PurchasingPowerBondsV2", description: "Workers afford life > wage slavery" },
    { name: "AIAccountabilityBondsV2", description: "Humans thriving > suffering from AI" },
    { name: "HealthCommonsBondsV2", description: "Health = right > commodity" },
    { name: "BuilderBeliefBondsV2", description: "Building > transacting" },
    { name: "VerdantAnchorBondsV2", description: "Earth regeneration > extraction" },
    { name: "EscapeVelocityBondsV2", description: "Poverty escape (50-500 stakes)" },
    { name: "AIPartnershipBondsV2", description: "AI grows WITH humans, not ABOVE" },
    { name: "CommonGroundBondsV2", description: "Bridge-building > division" }
  ];

  const deployedContracts = {};
  const startTime = Date.now();

  for (const bond of bonds) {
    console.log(`\n📝 Deploying ${bond.name}...`);
    console.log(`   Mission: ${bond.description}`);

    try {
      const BondContract = await hre.ethers.getContractFactory(bond.name);
      const bondInstance = await BondContract.deploy();
      await bondInstance.waitForDeployment();
      const address = await bondInstance.getAddress();

      deployedContracts[bond.name] = {
        address: address,
        description: bond.description,
        deployer: deployer.address,
        network: hre.network.name,
        deployedAt: new Date().toISOString(),
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
        version: "V2"
      };

      console.log(`✅ ${bond.name} deployed to: ${address}`);
    } catch (error) {
      console.error(`❌ Failed to deploy ${bond.name}:`, error.message);
      console.error(error);
      process.exit(1);
    }
  }

  const deployTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // Save deployment info
  const deploymentSummary = {
    version: "V2 - Production Ready",
    network: hre.network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    deploymentTime: `${deployTime}s`,
    totalContracts: Object.keys(deployedContracts).length,
    contracts: deployedContracts
  };

  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }

  const filename = `deployments/v2-bonds-${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentSummary, null, 2));

  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("✅ ALL 9 V2 BONDS DEPLOYED SUCCESSFULLY!");
  console.log("=".repeat(80));
  console.log(`\n⏱️  Total deployment time: ${deployTime}s`);
  console.log(`📝 Deployment summary saved to: ${filename}\n`);

  console.log("📊 Contract Addresses:");
  console.log("-".repeat(80));
  Object.entries(deployedContracts).forEach(([name, info]) => {
    console.log(`${name.padEnd(30)} ${info.address}`);
    console.log(`   └─ ${info.description}`);
  });

  console.log("\n🔍 Verify contracts on Basescan:");
  console.log("-".repeat(80));
  Object.entries(deployedContracts).forEach(([name, info]) => {
    console.log(`npx hardhat verify --network ${hre.network.name} ${info.address}`);
  });

  console.log("\n🎉 Vaultfire Protocol V2 is now LIVE and PRODUCTION READY!");
  console.log("   TRUE 10/10 Achievement Unlocked\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
