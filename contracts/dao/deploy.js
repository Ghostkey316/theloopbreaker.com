const { ethers } = require("hardhat");

async function deployDAO() {
  const [deployer] = await ethers.getSigners();

  const GuardianToken = await ethers.getContractFactory("VaultfireGuardianToken");
  const guardianToken = await GuardianToken.deploy(await deployer.getAddress());
  await guardianToken.waitForDeployment();

  const Timelock = await ethers.getContractFactory("TimelockController");
  const minDelay = 2 * 24 * 60 * 60;
  const timelock = await Timelock.deploy(minDelay, [await deployer.getAddress()], [await deployer.getAddress()], await deployer.getAddress());
  await timelock.waitForDeployment();

  const BaseOracle = await ethers.getContractFactory("BaseOracle");
  const baseOracle = await BaseOracle.deploy(await timelock.getAddress());
  await baseOracle.waitForDeployment();

  const Dao = await ethers.getContractFactory("VaultfireDAO");
  const dao = await Dao.deploy(await guardianToken.getAddress(), await timelock.getAddress(), await baseOracle.getAddress());
  await dao.waitForDeployment();

  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const timelockAdmin = await timelock.DEFAULT_ADMIN_ROLE();

  await (await timelock.grantRole(proposerRole, await dao.getAddress())).wait();
  await (await timelock.grantRole(executorRole, ethers.ZeroAddress)).wait();
  await (await timelock.revokeRole(timelockAdmin, await deployer.getAddress())).wait();
  await (await guardianToken.grantRole(await guardianToken.ATTESTOR_ROLE(), await deployer.getAddress())).wait();

  console.log("VaultfireGuardianToken:", await guardianToken.getAddress());
  console.log("TimelockController:", await timelock.getAddress());
  console.log("BaseOracle:", await baseOracle.getAddress());
  console.log("VaultfireDAO:", await dao.getAddress());

  return { guardianToken, timelock, baseOracle, dao };
}

if (require.main === module) {
  deployDAO()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { deployDAO };
