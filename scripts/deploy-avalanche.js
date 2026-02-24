/**
 * Vaultfire Protocol — Avalanche C-Chain Deployment
 *
 * Deploys all 13 core Vaultfire contracts to Avalanche C-Chain (mainnet or Fuji).
 * Avalanche is a SECONDARY supported chain — Base mainnet remains the canonical
 * deployment.  This script mirrors the Base deployment for cross-chain presence
 * as part of the Avalanche Build Games program.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-avalanche.js --network avalanche      # mainnet
 *   npx hardhat run scripts/deploy-avalanche.js --network avalancheFuji  # testnet
 *
 * Required environment variables:
 *   PRIVATE_KEY          — deployer wallet private key
 *   SNOWTRACE_API_KEY    — (optional) Snowtrace / Routescan API key for verification
 *
 * Deployer wallet: 0xA054f831B562e729F8D268291EBde1B2EDcFb84F
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DEPLOYER_EXPECTED = "0xA054f831B562e729F8D268291EBde1B2EDcFb84F";

// MultisigGovernance initial signers — same as Base deployment
const MULTISIG_SIGNERS = [DEPLOYER_EXPECTED];
const MULTISIG_THRESHOLD = 1;

// ProductionBeliefAttestationVerifier — placeholder RISC Zero verifier
// On a fresh chain the verifier address is not yet available; the deployer
// address is used as a stand-in and should be replaced post-deployment.
const RISC_ZERO_VERIFIER_PLACEHOLDER = DEPLOYER_EXPECTED;
const BELIEF_CIRCUIT_IMAGE_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

// Human treasury for AIAccountabilityBondsV2
const HUMAN_TREASURY = DEPLOYER_EXPECTED;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function deployContract(name, args = []) {
  const Factory = await hre.ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();
  console.log(`  ${name}: ${address}  (tx: ${tx.hash})`);
  return { contract, address, tx };
}

function explorerUrl(networkName, address) {
  if (networkName === "avalancheFuji") {
    return `https://testnet.snowtrace.io/address/${address}`;
  }
  return `https://snowtrace.io/address/${address}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const networkName = hre.network.name;
  const { chainId } = await hre.ethers.provider.getNetwork();

  // Safety check — only run on Avalanche networks
  const allowedChains = { avalanche: 43114n, avalancheFuji: 43113n };
  if (!allowedChains[networkName] || allowedChains[networkName] !== chainId) {
    console.error(
      `\nThis script is intended for Avalanche networks only.\n` +
      `  Network: ${networkName}  Chain ID: ${chainId}\n` +
      `  Allowed: avalanche (43114), avalancheFuji (43113)\n`
    );
    process.exit(1);
  }

  console.log("\n" + "=".repeat(80));
  console.log("  VAULTFIRE PROTOCOL — AVALANCHE DEPLOYMENT");
  console.log("  Chain: " + networkName + " (Chain ID " + chainId + ")");
  console.log("  Note: Base mainnet remains the PRIMARY / CANONICAL deployment.");
  console.log("=".repeat(80) + "\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "AVAX\n");

  if (balance < hre.ethers.parseEther("0.5")) {
    console.error("Insufficient AVAX for deployment (need >= 0.5 AVAX).");
    process.exit(1);
  }

  const startTime = Date.now();
  const deployed = {};

  // ========================================================================
  // Phase 1 — Independent contracts (no constructor dependencies)
  // ========================================================================
  console.log("Phase 1: Deploying independent contracts...\n");

  const privacyGuarantees = await deployContract("PrivacyGuarantees");
  deployed.PrivacyGuarantees = privacyGuarantees.address;

  const missionEnforcement = await deployContract("MissionEnforcement");
  deployed.MissionEnforcement = missionEnforcement.address;

  const antiSurveillance = await deployContract("AntiSurveillance");
  deployed.AntiSurveillance = antiSurveillance.address;

  const identityRegistry = await deployContract("ERC8004IdentityRegistry");
  deployed.ERC8004IdentityRegistry = identityRegistry.address;

  const beliefVerifier = await deployContract("BeliefAttestationVerifier");
  deployed.BeliefAttestationVerifier = beliefVerifier.address;

  const partnershipBonds = await deployContract("AIPartnershipBondsV2");
  deployed.AIPartnershipBondsV2 = partnershipBonds.address;

  const flourishingOracle = await deployContract("FlourishingMetricsOracle");
  deployed.FlourishingMetricsOracle = flourishingOracle.address;

  // ========================================================================
  // Phase 2 — Contracts that depend on Phase 1 addresses
  // ========================================================================
  console.log("\nPhase 2: Deploying dependent contracts...\n");

  const reputationRegistry = await deployContract("ERC8004ReputationRegistry", [
    identityRegistry.address,
  ]);
  deployed.ERC8004ReputationRegistry = reputationRegistry.address;

  const validationRegistry = await deployContract("ERC8004ValidationRegistry", [
    identityRegistry.address,
    beliefVerifier.address,
  ]);
  deployed.ERC8004ValidationRegistry = validationRegistry.address;

  const accountabilityBonds = await deployContract("AIAccountabilityBondsV2", [
    HUMAN_TREASURY,
  ]);
  deployed.AIAccountabilityBondsV2 = accountabilityBonds.address;

  const adapter = await deployContract("VaultfireERC8004Adapter", [
    partnershipBonds.address,
    identityRegistry.address,
    reputationRegistry.address,
    validationRegistry.address,
  ]);
  deployed.VaultfireERC8004Adapter = adapter.address;

  const multisig = await deployContract("MultisigGovernance", [
    MULTISIG_SIGNERS,
    MULTISIG_THRESHOLD,
  ]);
  deployed.MultisigGovernance = multisig.address;

  const productionVerifier = await deployContract(
    "ProductionBeliefAttestationVerifier",
    [RISC_ZERO_VERIFIER_PLACEHOLDER, BELIEF_CIRCUIT_IMAGE_ID]
  );
  deployed.ProductionBeliefAttestationVerifier = productionVerifier.address;

  // ========================================================================
  // Save deployment manifest
  // ========================================================================
  const endTime = Date.now();
  const deploymentMinutes = ((endTime - startTime) / 1000 / 60).toFixed(2);

  const manifest = {
    protocol: "Vaultfire",
    chain: networkName,
    chainId: Number(chainId),
    canonical: false, // Base is canonical
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    deploymentTimeMinutes: deploymentMinutes,
    contracts: deployed,
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const outFile = path.join(
    deploymentsDir,
    `avalanche-${networkName}-${Date.now()}.json`
  );
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));

  // ========================================================================
  // Summary
  // ========================================================================
  console.log("\n" + "=".repeat(80));
  console.log("  DEPLOYMENT COMPLETE — " + networkName);
  console.log("=".repeat(80) + "\n");
  console.log(`  Time: ${deploymentMinutes} minutes\n`);
  console.log("  Deployed contracts:\n");
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`    ${name}`);
    console.log(`      ${explorerUrl(networkName, addr)}\n`);
  }
  console.log(`  Manifest saved: ${outFile}\n`);

  // ========================================================================
  // Verification commands
  // ========================================================================
  console.log("=".repeat(80));
  console.log("  CONTRACT VERIFICATION (Snowtrace / Routescan)");
  console.log("=".repeat(80) + "\n");
  console.log("  Run the following commands to verify each contract:\n");

  // No-arg contracts
  const noArgContracts = [
    "PrivacyGuarantees",
    "MissionEnforcement",
    "AntiSurveillance",
    "ERC8004IdentityRegistry",
    "BeliefAttestationVerifier",
    "AIPartnershipBondsV2",
    "FlourishingMetricsOracle",
  ];
  for (const name of noArgContracts) {
    console.log(
      `  npx hardhat verify --network ${networkName} ${deployed[name]}`
    );
  }

  // Contracts with constructor args
  console.log(
    `  npx hardhat verify --network ${networkName} ${deployed.ERC8004ReputationRegistry} "${deployed.ERC8004IdentityRegistry}"`
  );
  console.log(
    `  npx hardhat verify --network ${networkName} ${deployed.ERC8004ValidationRegistry} "${deployed.ERC8004IdentityRegistry}" "${deployed.BeliefAttestationVerifier}"`
  );
  console.log(
    `  npx hardhat verify --network ${networkName} ${deployed.AIAccountabilityBondsV2} "${HUMAN_TREASURY}"`
  );
  console.log(
    `  npx hardhat verify --network ${networkName} ${deployed.VaultfireERC8004Adapter} "${deployed.AIPartnershipBondsV2}" "${deployed.ERC8004IdentityRegistry}" "${deployed.ERC8004ReputationRegistry}" "${deployed.ERC8004ValidationRegistry}"`
  );
  console.log(
    `  npx hardhat verify --network ${networkName} ${deployed.MultisigGovernance} "[${MULTISIG_SIGNERS.map((s) => '"' + s + '"').join(",")}]" ${MULTISIG_THRESHOLD}`
  );
  console.log(
    `  npx hardhat verify --network ${networkName} ${deployed.ProductionBeliefAttestationVerifier} "${RISC_ZERO_VERIFIER_PLACEHOLDER}" "${BELIEF_CIRCUIT_IMAGE_ID}"`
  );

  console.log("\n" + "=".repeat(80));
  console.log("  Base mainnet remains the PRIMARY deployment.");
  console.log("  This Avalanche deployment is a secondary supported chain.");
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nDeployment failed:\n");
    console.error(error);
    process.exit(1);
  });
