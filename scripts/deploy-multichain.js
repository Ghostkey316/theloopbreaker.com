/**
 * Vaultfire Protocol — Master Multichain Deployment Script
 *
 * Deploys all 13 core Vaultfire contracts to any supported chain.
 * Automatically detects the target network from the Hardhat --network flag
 * and applies chain-specific configuration.
 *
 * Supported chains:
 *   - Base mainnet   (Chain ID 8453)  — PRIMARY / CANONICAL
 *   - Base Sepolia   (Chain ID 84532) — Base testnet
 *   - Avalanche      (Chain ID 43114) — SECONDARY (Build Games)
 *   - Avalanche Fuji (Chain ID 43113) — Avalanche testnet
 *
 * Usage:
 *   npx hardhat run scripts/deploy-multichain.js --network baseMainnet
 *   npx hardhat run scripts/deploy-multichain.js --network avalanche
 *   npx hardhat run scripts/deploy-multichain.js --network avalancheFuji
 *
 * Required environment variables:
 *   PRIVATE_KEY — deployer wallet private key
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Chain registry
// ---------------------------------------------------------------------------
const CHAINS = {
  baseMainnet: {
    chainId: 8453n,
    label: "Base Mainnet",
    role: "primary",
    nativeCurrency: "ETH",
    explorer: "https://basescan.org",
    minBalance: "0.01",
  },
  baseSepolia: {
    chainId: 84532n,
    label: "Base Sepolia",
    role: "testnet",
    nativeCurrency: "ETH",
    explorer: "https://sepolia.basescan.org",
    minBalance: "0.01",
  },
  avalanche: {
    chainId: 43114n,
    label: "Avalanche C-Chain",
    role: "secondary",
    nativeCurrency: "AVAX",
    explorer: "https://snowtrace.io",
    minBalance: "0.5",
  },
  avalancheFuji: {
    chainId: 43113n,
    label: "Avalanche Fuji",
    role: "testnet",
    nativeCurrency: "AVAX",
    explorer: "https://testnet.snowtrace.io",
    minBalance: "0.5",
  },
};

// ---------------------------------------------------------------------------
// Deployment configuration
// ---------------------------------------------------------------------------
const DEPLOYER_EXPECTED = "0xA054f831B562e729F8D268291EBde1B2EDcFb84F";
const MULTISIG_SIGNERS = [DEPLOYER_EXPECTED];
const MULTISIG_THRESHOLD = 1;
const RISC_ZERO_VERIFIER_PLACEHOLDER = DEPLOYER_EXPECTED;
const BELIEF_CIRCUIT_IMAGE_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const networkName = hre.network.name;
  const { chainId } = await hre.ethers.provider.getNetwork();
  const chainCfg = CHAINS[networkName];

  if (!chainCfg) {
    console.error(
      `\nUnsupported network: "${networkName}".\n` +
      `Supported networks: ${Object.keys(CHAINS).join(", ")}\n`
    );
    process.exit(1);
  }

  if (chainCfg.chainId !== chainId) {
    console.error(
      `\nChain ID mismatch: expected ${chainCfg.chainId}, got ${chainId}.\n`
    );
    process.exit(1);
  }

  const roleLabel =
    chainCfg.role === "primary"
      ? "PRIMARY / CANONICAL"
      : chainCfg.role === "secondary"
        ? "SECONDARY"
        : "TESTNET";

  console.log("\n" + "=".repeat(80));
  console.log("  VAULTFIRE PROTOCOL — MULTICHAIN DEPLOYMENT");
  console.log(`  Target : ${chainCfg.label} (Chain ID ${chainId})`);
  console.log(`  Role   : ${roleLabel}`);
  console.log("=".repeat(80) + "\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(
    "Balance:",
    hre.ethers.formatEther(balance),
    chainCfg.nativeCurrency + "\n"
  );

  if (balance < hre.ethers.parseEther(chainCfg.minBalance)) {
    console.error(
      `Insufficient ${chainCfg.nativeCurrency} (need >= ${chainCfg.minBalance}).`
    );
    process.exit(1);
  }

  const startTime = Date.now();
  const deployed = {};

  // ========================================================================
  // Phase 1 — Independent contracts
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
  // Phase 2 — Dependent contracts
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
    role: chainCfg.role,
    canonical: chainCfg.role === "primary",
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
    `${networkName}-${Date.now()}.json`
  );
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));

  // ========================================================================
  // Summary
  // ========================================================================
  console.log("\n" + "=".repeat(80));
  console.log(`  DEPLOYMENT COMPLETE — ${chainCfg.label} (${roleLabel})`);
  console.log("=".repeat(80) + "\n");
  console.log(`  Time: ${deploymentMinutes} minutes\n`);
  console.log("  Deployed contracts:\n");
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`    ${name}: ${addr}`);
    console.log(`      ${chainCfg.explorer}/address/${addr}\n`);
  }
  console.log(`  Manifest saved: ${outFile}\n`);

  if (chainCfg.role !== "primary") {
    console.log("  Note: Base mainnet remains the PRIMARY deployment.\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nDeployment failed:\n");
    console.error(error);
    process.exit(1);
  });
