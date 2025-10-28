const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

function loadArtifact(name) {
  const artifactPath = path.join(__dirname, "..", "..", "artifacts", "contracts", "VaultfireDAO.sol", `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Missing artifact for ${name}. Run hardhat compile first.`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function deployLive() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.BASE_RPC_URL;
  const privateKey = process.env.VAULTFIRE_DAO_KEY || process.env.PRIVATE_KEY;
  if (!rpcUrl) {
    throw new Error("Set SEPOLIA_RPC_URL (or BASE_RPC_URL) to deploy VaultfireDAO");
  }
  if (!privateKey) {
    throw new Error("Set VAULTFIRE_DAO_KEY (or PRIVATE_KEY) with deployment credentials");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const guardianArtifact = loadArtifact("VaultfireGuardianToken");
  const timelockArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "..", "artifacts", "@openzeppelin", "contracts", "governance", "TimelockController.sol", "TimelockController.json"), "utf8")
  );
  const oracleArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "..", "artifacts", "contracts", "BaseOracle.sol", "BaseOracle.json"), "utf8")
  );
  const daoArtifact = loadArtifact("VaultfireDAO");

  const guardianFactory = new ethers.ContractFactory(guardianArtifact.abi, guardianArtifact.bytecode, wallet);
  const guardian = await guardianFactory.deploy(wallet.address);
  await guardian.waitForDeployment();

  const timelockFactory = new ethers.ContractFactory(timelockArtifact.abi, timelockArtifact.bytecode, wallet);
  const minDelay = 2 * 24 * 60 * 60;
  const timelock = await timelockFactory.deploy(minDelay, [wallet.address], [wallet.address], wallet.address);
  await timelock.waitForDeployment();

  const oracleFactory = new ethers.ContractFactory(oracleArtifact.abi, oracleArtifact.bytecode, wallet);
  const oracle = await oracleFactory.deploy(await timelock.getAddress());
  await oracle.waitForDeployment();

  const daoFactory = new ethers.ContractFactory(daoArtifact.abi, daoArtifact.bytecode, wallet);
  const dao = await daoFactory.deploy(await guardian.getAddress(), await timelock.getAddress(), await oracle.getAddress());
  await dao.waitForDeployment();

  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const timelockAdmin = await timelock.DEFAULT_ADMIN_ROLE();

  await (await timelock.grantRole(proposerRole, await dao.getAddress())).wait();
  await (await timelock.grantRole(executorRole, ethers.ZeroAddress)).wait();
  await (await timelock.revokeRole(timelockAdmin, wallet.address)).wait();
  await (await guardian.grantRole(await guardian.ATTESTOR_ROLE(), wallet.address)).wait();

  console.log(JSON.stringify({
    guardianToken: await guardian.getAddress(),
    timelock: await timelock.getAddress(),
    baseOracle: await oracle.getAddress(),
    dao: await dao.getAddress(),
  }, null, 2));
}

if (require.main === module) {
  deployLive().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { deployLive };
