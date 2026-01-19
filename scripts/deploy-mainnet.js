const hre = require("hardhat");

async function main() {
  console.log("\n🔥🔥🔥 VAULTFIRE MAINNET DEPLOYMENT 🔥🔥🔥\n");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  const balance = await deployer.getBalance();
  console.log("Balance:", hre.ethers.utils.formatEther(balance), "ETH\n");
  if (balance.lt(hre.ethers.utils.parseEther("0.01"))) {
    console.log("❌ Insufficient ETH");
    process.exit(1);
  }
  console.log("⏳ Waiting 10 seconds... (Ctrl+C to cancel)\n");
  await new Promise(resolve => setTimeout(resolve, 10000));
  console.log("🚀 Deploying DilithiumAttestor...\n");
  const DilithiumAttestor = await hre.ethers.getContractFactory("DilithiumAttestor");
  const attestor = await DilithiumAttestor.deploy(deployer.address, false, hre.ethers.constants.AddressZero);
  await attestor.deployed();
  console.log("\n✅✅✅ DEPLOYED TO MAINNET! ✅✅✅");
  console.log("\nContract:", attestor.address);
  console.log("TX:", attestor.deployTransaction.hash);
  console.log("\nhttps://basescan.org/address/" + attestor.address);
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
