const hre = require("hardhat");

async function main() {
  console.log("Deploying Purchasing Power Bonds to Base mainnet...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy Purchasing Power Bonds
  const PurchasingPowerBonds = await hre.ethers.getContractFactory("PurchasingPowerBonds");
  const bonds = await PurchasingPowerBonds.deploy();

  await bonds.waitForDeployment();
  const address = await bonds.getAddress();

  console.log("✅ Purchasing Power Bonds deployed to:", address);

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    contract: "PurchasingPowerBonds",
    address: address,
    deployer: deployer.address,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString()
  };

  fs.writeFileSync(
    `deployments/purchasing-power-bonds-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n📝 Deployment info saved to deployments/");
  console.log("\n🔍 Verify with:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
