const hre = require("hardhat");

async function main() {
  console.log("\n🔥🔥🔥 VAULTFIRE MAINNET DEPLOYMENT 🔥🔥🔥\n");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");
  
  if (balance < hre.ethers.parseEther("0.01")) {
    console.log("❌ Insufficient ETH");
    process.exit(1);
  }
  
  console.log("⏳ Waiting 10 seconds... (Ctrl+C to cancel)\n");
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log("🚀 Deploying DilithiumAttestor...\n");
  
  const DilithiumAttestor = await hre.ethers.getContractFactory("DilithiumAttestor");
  const attestor = await DilithiumAttestor.deploy(deployer.address, false, hre.ethers.ZeroAddress);
  
  await attestor.waitForDeployment();
  const address = await attestor.getAddress();
  
  console.log("\n✅✅✅ DEPLOYED TO MAINNET! ✅✅✅");
  console.log("\nContract:", address);
  console.log("TX:", attestor.deploymentTransaction().hash);
  console.log("\nhttps://basescan.org/address/" + address);
}

main().then(() => process.exit(0)).catch((error) => { 
  console.error(error); 
  process.exit(1); 
});
