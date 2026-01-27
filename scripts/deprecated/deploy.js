const hre = require("hardhat");

async function main() {
  const Unlock = await hre.ethers.getContractFactory("ContributorUnlockKey");
  const unlock = await Unlock.deploy();
  await unlock.deployed();
  console.log(`ContributorUnlockKey deployed to ${unlock.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
