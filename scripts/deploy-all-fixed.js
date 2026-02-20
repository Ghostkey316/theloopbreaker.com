/**
 * Vaultfire Protocol — Fixed Full Deployment Script
 * Deploys all 14 contracts sequentially with correct constructor args.
 * Waits for each tx to confirm before sending the next (avoids nonce issues).
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const COMPROMISED_WALLET = "0xf6A677de83c407875c9a9115cf100f121f9c4816";
const TELEPORTER_MESSENGER = "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf";
const REQUIRED_GAS_LIMIT = 500000;

async function deployContract(name, args = []) {
  try {
    const Factory = await hre.ethers.getContractFactory(name);
    console.log(`  Deploying ${name}...`);
    const contract = await Factory.deploy(...args);
    const receipt = await contract.deploymentTransaction().wait(2); // wait 2 confirmations
    const address = await contract.getAddress();
    const txHash = contract.deploymentTransaction().hash;
    console.log(`  ✅ ${name}`);
    console.log(`     Address: ${address}`);
    console.log(`     TX:      ${txHash}`);
    console.log(`     Gas:     ${receipt.gasUsed.toString()}`);
    console.log();
    return { address, txHash, success: true };
  } catch (err) {
    console.log(`  ❌ ${name} FAILED: ${err.message.slice(0, 200)}`);
    console.log();
    return { address: null, txHash: null, success: false, error: err.message };
  }
}

async function main() {
  const networkName = hre.network.name;
  const { chainId } = await hre.ethers.provider.getNetwork();
  const [deployer] = await hre.ethers.getSigners();

  if (deployer.address.toLowerCase() === COMPROMISED_WALLET.toLowerCase()) {
    console.error("❌ CRITICAL: Deployer is the COMPROMISED wallet!");
    process.exit(1);
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("\n" + "═".repeat(70));
  console.log("  VAULTFIRE PROTOCOL — FULL DEPLOYMENT (ALL 14 CONTRACTS)");
  console.log("  Chain:    " + networkName + " (Chain ID " + chainId + ")");
  console.log("  Deployer: " + deployer.address);
  console.log("  Balance:  " + hre.ethers.formatEther(balance));
  console.log("═".repeat(70) + "\n");

  const results = {};
  const constructorArgs = {};

  // ═══ Phase 1: No-arg contracts (deployed sequentially) ═══
  console.log("━━━ Phase 1: Core Contracts ━━━\n");

  results.MissionEnforcement = await deployContract("MissionEnforcement");
  results.AntiSurveillance = await deployContract("AntiSurveillance");
  results.PrivacyGuarantees = await deployContract("PrivacyGuarantees");
  results.ERC8004IdentityRegistry = await deployContract("ERC8004IdentityRegistry");
  results.BeliefAttestationVerifier = await deployContract("BeliefAttestationVerifier");
  results.AIPartnershipBondsV2 = await deployContract("AIPartnershipBondsV2");
  results.FlourishingMetricsOracle = await deployContract("FlourishingMetricsOracle");

  // ═══ Phase 2: Contracts with constructor args ═══
  console.log("━━━ Phase 2: Contracts with Dependencies ━━━\n");

  // AIAccountabilityBondsV2(address humanTreasury)
  const accArgs = [deployer.address];
  results.AIAccountabilityBondsV2 = await deployContract("AIAccountabilityBondsV2", accArgs);
  constructorArgs.AIAccountabilityBondsV2 = accArgs;

  // ERC8004ReputationRegistry(address _identityRegistry)
  const repArgs = [results.ERC8004IdentityRegistry.address];
  results.ERC8004ReputationRegistry = await deployContract("ERC8004ReputationRegistry", repArgs);
  constructorArgs.ERC8004ReputationRegistry = repArgs;

  // ERC8004ValidationRegistry(address _identityRegistry, address _zkVerifier)
  const valArgs = [results.ERC8004IdentityRegistry.address, deployer.address]; // deployer as placeholder zkVerifier
  results.ERC8004ValidationRegistry = await deployContract("ERC8004ValidationRegistry", valArgs);
  constructorArgs.ERC8004ValidationRegistry = valArgs;

  // VaultfireERC8004Adapter(address _partnershipBonds, address _identityRegistry, address _reputationRegistry, address _validationRegistry)
  const adapterArgs = [
    results.AIPartnershipBondsV2.address,
    results.ERC8004IdentityRegistry.address,
    results.ERC8004ReputationRegistry.address,
    results.ERC8004ValidationRegistry.address,
  ];
  results.VaultfireERC8004Adapter = await deployContract("VaultfireERC8004Adapter", adapterArgs);
  constructorArgs.VaultfireERC8004Adapter = adapterArgs;

  // MultisigGovernance(address[] signers, uint256 threshold)
  const govArgs = [[deployer.address], 1];
  results.MultisigGovernance = await deployContract("MultisigGovernance", govArgs);
  constructorArgs.MultisigGovernance = govArgs;

  // ProductionBeliefAttestationVerifier(address riscZeroVerifier, bytes32 imageId)
  const prodArgs = [
    deployer.address,
    "0x0000000000000000000000000000000000000000000000000000000000000001",
  ];
  results.ProductionBeliefAttestationVerifier = await deployContract(
    "ProductionBeliefAttestationVerifier",
    prodArgs
  );
  constructorArgs.ProductionBeliefAttestationVerifier = prodArgs;

  // VaultfireTeleporterBridge(address teleporterMessenger, uint256 requiredGasLimit)
  const bridgeArgs = [TELEPORTER_MESSENGER, REQUIRED_GAS_LIMIT];
  results.VaultfireTeleporterBridge = await deployContract("VaultfireTeleporterBridge", bridgeArgs);
  constructorArgs.VaultfireTeleporterBridge = bridgeArgs;

  // ═══ Summary ═══
  console.log("\n" + "═".repeat(70));
  console.log("  DEPLOYMENT SUMMARY");
  console.log("═".repeat(70));

  const contracts = {};
  const transactions = {};
  let successCount = 0;
  let failCount = 0;

  for (const [name, result] of Object.entries(results)) {
    if (result.success) {
      contracts[name] = result.address;
      transactions[name] = result.txHash;
      successCount++;
      console.log(`  ✅ ${name}: ${result.address}`);
    } else {
      failCount++;
      console.log(`  ❌ ${name}: FAILED`);
    }
  }

  const endBalance = await hre.ethers.provider.getBalance(deployer.address);
  const gasSpent = hre.ethers.formatEther(balance - endBalance);

  console.log(`\n  Total: ${successCount} succeeded, ${failCount} failed`);
  console.log(`  Gas spent: ${gasSpent} ETH/AVAX`);
  console.log(`  Remaining: ${hre.ethers.formatEther(endBalance)}`);
  console.log("═".repeat(70) + "\n");

  const report = {
    protocol: "Vaultfire",
    chain: networkName,
    chainId: Number(chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts,
    constructorArgs,
    transactions,
    successCount,
    failCount,
    gasSpent,
  };

  const reportFile = path.join(
    __dirname, "..", "deployments",
    `${networkName}-full-deploy-${Date.now()}.json`
  );
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved: ${reportFile}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
