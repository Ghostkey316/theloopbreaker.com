/**
 * Vaultfire Protocol — Deploy Missing Contracts on Avalanche
 * 
 * Avalanche already has 8 contracts. This deploys the 6 missing ones:
 * 1. PrivacyGuarantees (no args)
 * 2. BeliefAttestationVerifier (no args)
 * 3. ERC8004ReputationRegistry (identityRegistry)
 * 4. ERC8004ValidationRegistry (identityRegistry, zkVerifier)
 * 5. VaultfireERC8004Adapter (partnershipBonds, identityRegistry, reputationRegistry, validationRegistry)
 * 6. MultisigGovernance (signers[], threshold)
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const COMPROMISED_WALLET = "0xf6A677de83c407875c9a9115cf100f121f9c4816";

// Existing Avalanche addresses from earlier deployment
const EXISTING = {
  ERC8004IdentityRegistry: "0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5",
  AIPartnershipBondsV2: "0x37679B1dCfabE6eA6b8408626815A1426bE2D717",
};

async function deployContract(name, args = []) {
  try {
    const Factory = await hre.ethers.getContractFactory(name);
    console.log(`  Deploying ${name}...`);
    const contract = await Factory.deploy(...args);
    const receipt = await contract.deploymentTransaction().wait(2);
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
  console.log("  VAULTFIRE — AVALANCHE MISSING CONTRACTS (6 of 14)");
  console.log("  Chain:    " + networkName + " (Chain ID " + chainId + ")");
  console.log("  Deployer: " + deployer.address);
  console.log("  Balance:  " + hre.ethers.formatEther(balance) + " AVAX");
  console.log("═".repeat(70) + "\n");

  const results = {};
  const constructorArgs = {};

  // No-arg contracts
  results.PrivacyGuarantees = await deployContract("PrivacyGuarantees");
  results.BeliefAttestationVerifier = await deployContract("BeliefAttestationVerifier");

  // ERC8004ReputationRegistry(address _identityRegistry)
  const repArgs = [EXISTING.ERC8004IdentityRegistry];
  results.ERC8004ReputationRegistry = await deployContract("ERC8004ReputationRegistry", repArgs);
  constructorArgs.ERC8004ReputationRegistry = repArgs;

  // ERC8004ValidationRegistry(address _identityRegistry, address _zkVerifier)
  const valArgs = [EXISTING.ERC8004IdentityRegistry, deployer.address];
  results.ERC8004ValidationRegistry = await deployContract("ERC8004ValidationRegistry", valArgs);
  constructorArgs.ERC8004ValidationRegistry = valArgs;

  // VaultfireERC8004Adapter(address _partnershipBonds, address _identityRegistry, address _reputationRegistry, address _validationRegistry)
  const adapterArgs = [
    EXISTING.AIPartnershipBondsV2,
    EXISTING.ERC8004IdentityRegistry,
    results.ERC8004ReputationRegistry.address,
    results.ERC8004ValidationRegistry.address,
  ];
  results.VaultfireERC8004Adapter = await deployContract("VaultfireERC8004Adapter", adapterArgs);
  constructorArgs.VaultfireERC8004Adapter = adapterArgs;

  // MultisigGovernance(address[] signers, uint256 threshold)
  const govArgs = [[deployer.address], 1];
  results.MultisigGovernance = await deployContract("MultisigGovernance", govArgs);
  constructorArgs.MultisigGovernance = govArgs;

  // Summary
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
  console.log(`  Gas spent: ${gasSpent} AVAX`);
  console.log(`  Remaining: ${hre.ethers.formatEther(endBalance)} AVAX`);
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
    `${networkName}-missing-deploy-${Date.now()}.json`
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
